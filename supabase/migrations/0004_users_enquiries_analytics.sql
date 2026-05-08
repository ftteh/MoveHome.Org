-- 0004_users_enquiries_analytics.sql
--
-- MoveHome-specific tables. None of this exists in the raia repo — it's the
-- consumer-side surface (users, saved searches, enquiries, analytics).
--
-- Single-tenant — no organisation_id, no current_org_id() function. RLS is
-- user-scoped where data is per-user, service-role-only where it's analytics.

-- ── tbl_users ──────────────────────────────────────────────────────────────
-- Profile extension for auth.users. Auto-populated on signup via trigger.
CREATE TABLE public.tbl_users (
    id            UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email         TEXT         NOT NULL UNIQUE,
    display_name  TEXT         NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tbl_users IS
    'Profile extension for auth.users. Populated on first sign-in via the '
    'on_auth_user_created trigger.';

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.tbl_users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tbl_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tbl_users_self_select ON public.tbl_users
    FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY tbl_users_self_update ON public.tbl_users
    FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO public.tbl_users (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── tbl_saved_searches ─────────────────────────────────────────────────────
-- User-defined search filters. alert_frequency is a forward-looking column —
-- the digest worker is deferred to v2 (no Resend wiring on day 1).
CREATE TABLE public.tbl_saved_searches (
    search_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name             TEXT         NOT NULL,
    filters          JSONB        NOT NULL,
    alert_frequency  TEXT         NULL CHECK (alert_frequency IS NULL OR alert_frequency IN
                       ('daily', 'weekly', 'instant')),
    last_run_at      TIMESTAMPTZ  NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tbl_saved_searches IS
    'User-defined search filters. alert_frequency drives a future email '
    'digest cron — column exists but no worker is wired in v1.';

CREATE INDEX idx_saved_searches_user ON public.tbl_saved_searches (user_id);
CREATE INDEX idx_saved_searches_alert
    ON public.tbl_saved_searches (alert_frequency)
    WHERE alert_frequency IS NOT NULL;

CREATE TRIGGER trg_saved_searches_updated_at
    BEFORE UPDATE ON public.tbl_saved_searches
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tbl_saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY tbl_saved_searches_owner ON public.tbl_saved_searches
    FOR ALL TO authenticated
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── tbl_enquiries ──────────────────────────────────────────────────────────
-- Lead capture from the MoveHome.org UI. POST /api/enquire creates a row
-- here, then the API forwards a v0.2 enquiry.json payload to the source
-- agent's enquiry_endpoint and records the outcome.
--
-- enquiry_id is the same UUID we put on the wire (sender-generated for
-- idempotency per enquiry.json).
CREATE TABLE public.tbl_enquiries (
    enquiry_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    raia_id             TEXT         NOT NULL
                          CHECK (raia_id ~ '^prop-[a-z]{2}-[a-z0-9-]{2,32}-[0-9]{4,}$'),
    agent_id            TEXT         NOT NULL
                          REFERENCES public.tbl_raia_agent_registry(agent_id),
    user_id             UUID         NULL REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Flattened enquirer block from enquiry.json
    enquirer_name       TEXT         NOT NULL,
    enquirer_email      TEXT         NOT NULL,
    enquirer_phone      TEXT         NULL,
    preferred_contact   TEXT         NULL CHECK (preferred_contact IS NULL OR preferred_contact IN
                          ('email', 'phone', 'whatsapp')),

    message             TEXT         NOT NULL CHECK (length(message) BETWEEN 1 AND 2000),

    -- Optional protocol-shaped sub-blocks (stored verbatim).
    viewing_request     JSONB        NULL,    -- enquiry.json/viewing_request_block
    source              JSONB        NULL,    -- enquiry.json/source_block

    status              TEXT         NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new', 'forwarded', 'responded', 'closed')),
    forwarded_at        TIMESTAMPTZ  NULL,
    forwarded_response  JSONB        NULL,    -- HTTP status + body from agent's /api/raia/enquire

    submitted_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tbl_enquiries IS
    'Enquiries submitted via MoveHome.org. Mirrors RAIA Protocol v0.2 '
    'enquiry.json — flattened enquirer fields + JSONB for viewing_request '
    'and source blocks. The /api/enquire route forwards the constructed '
    'payload to the agent''s enquiry_endpoint and writes the response back.';

CREATE INDEX idx_enquiries_user      ON public.tbl_enquiries (user_id);
CREATE INDEX idx_enquiries_agent     ON public.tbl_enquiries (agent_id);
CREATE INDEX idx_enquiries_raia      ON public.tbl_enquiries (raia_id);
CREATE INDEX idx_enquiries_status    ON public.tbl_enquiries (status);
CREATE INDEX idx_enquiries_submitted ON public.tbl_enquiries (submitted_at DESC);

CREATE TRIGGER trg_enquiries_updated_at
    BEFORE UPDATE ON public.tbl_enquiries
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tbl_enquiries ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own enquiries. Insert + forward state
-- transitions go through the API route (service-role).
CREATE POLICY tbl_enquiries_self_select ON public.tbl_enquiries
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── tbl_listing_views — analytics ──────────────────────────────────────────
-- One row per listing detail-page view. Service-role write only.
CREATE TABLE public.tbl_listing_views (
    view_id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    raia_id           TEXT         NOT NULL,
    external_id       UUID         NULL,    -- nullable: row may predate the cache
    user_id           UUID         NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    anon_session_id   TEXT         NULL,
    referrer          TEXT         NULL,
    viewed_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tbl_listing_views IS
    'Analytics — one row per listing detail-page view. anon_session_id is a '
    'client-issued UUID. Service-role write only.';

CREATE INDEX idx_listing_views_raia
    ON public.tbl_listing_views (raia_id, viewed_at DESC);
CREATE INDEX idx_listing_views_user
    ON public.tbl_listing_views (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.tbl_listing_views ENABLE ROW LEVEL SECURITY;
-- No public read; service-role only.

-- ── tbl_agent_clicks — analytics ───────────────────────────────────────────
CREATE TABLE public.tbl_agent_clicks (
    click_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id          TEXT         NOT NULL,    -- intentionally NOT FK — keep history if agent revoked
    source_raia_id    TEXT         NULL,
    user_id           UUID         NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    anon_session_id   TEXT         NULL,
    clicked_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tbl_agent_clicks IS
    'Analytics — outbound clicks to agent profile / agent card URL. '
    'Service-role write only.';

CREATE INDEX idx_agent_clicks_agent
    ON public.tbl_agent_clicks (agent_id, clicked_at DESC);
CREATE INDEX idx_agent_clicks_user
    ON public.tbl_agent_clicks (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.tbl_agent_clicks ENABLE ROW LEVEL SECURITY;
-- No public read; service-role only.
