-- 0002_raia_agent_registry.sql
--
-- Federated agent directory. One row per estate / letting agent that exposes
-- a /.well-known/raia-agent.json card. Trust tier governs whether their
-- listings appear in MoveHome's public search.
--
-- Schema baselined against RAIA Protocol v0.2 (agent-card.json) and raia
-- repo's V180 SQL on main. agent_id pattern matches the protocol regex
-- ^org-[a-z]{2}-[a-z0-9-]{2,32}$ (e.g. org-gb-rlf, org-th-rbc).
--
-- Service-role write only. Public reads go through vw_raia_agent_registry_public.

CREATE TABLE public.tbl_raia_agent_registry (
    agent_id                TEXT        PRIMARY KEY
                              CHECK (agent_id ~ '^org-[a-z]{2}-[a-z0-9-]{2,32}$'),
    agent_card_url          TEXT        NOT NULL,
    name                    TEXT        NULL,
    display_name            TEXT        NULL,
    description             TEXT        NULL,
    logo_url                TEXT        NULL,

    -- Schema version the agent declared in their card (e.g. '0.2').
    schema_version          TEXT        NULL,

    -- Capabilities advertised in agent-card.capabilities.
    capabilities            TEXT[]      NULL,

    -- UN/LOCODEs the agent operates in (agent-card.jurisdictions).
    jurisdictions           TEXT[]      NULL,

    discovered_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    discovery_method        TEXT        NOT NULL
                              CHECK (discovery_method IN ('self_submit', 'companies_house_etl', 'manual')),

    verification_status     TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended')),

    trust_tier              TEXT        NOT NULL DEFAULT 'unverified'
                              CHECK (trust_tier IN ('unverified', 'auto_verified', 'manually_verified', 'platform_member')),

    last_crawled_at         TIMESTAMPTZ NULL,
    last_crawl_status       TEXT        NULL,
    last_crawl_error        TEXT        NULL,
    listing_count_last      INTEGER     NULL,

    contact_email           TEXT        NULL,
    contact_phone           TEXT        NULL,
    companies_house_number  TEXT        NULL,

    notes                   TEXT        NULL,
    revoked_at              TIMESTAMPTZ NULL,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tbl_raia_agent_registry IS
    'Federated agent directory. Every estate / letting agent that exposes a '
    '/.well-known/raia-agent.json card we have crawled. trust_tier governs '
    'whether listings from that agent are surfaced in MoveHome search. '
    'Service-role write; public read on a curated column subset via '
    'vw_raia_agent_registry_public.';

COMMENT ON COLUMN public.tbl_raia_agent_registry.agent_id IS
    'Stable identifier matching RAIA Protocol v0.2 regex '
    '^org-[a-z]{2}-[a-z0-9-]{2,32}$. Example: org-gb-rlf, org-th-rbc.';

COMMENT ON COLUMN public.tbl_raia_agent_registry.trust_tier IS
    'unverified < auto_verified < manually_verified < platform_member. '
    'Listings from unverified agents are not surfaced in public search.';

CREATE INDEX idx_raia_agent_registry_status
    ON public.tbl_raia_agent_registry (verification_status);

CREATE INDEX idx_raia_agent_registry_trust
    ON public.tbl_raia_agent_registry (trust_tier)
    WHERE revoked_at IS NULL;

CREATE INDEX idx_raia_agent_registry_last_crawled
    ON public.tbl_raia_agent_registry (last_crawled_at)
    WHERE revoked_at IS NULL;

CREATE INDEX idx_raia_agent_registry_jurisdictions
    ON public.tbl_raia_agent_registry USING GIN (jurisdictions)
    WHERE revoked_at IS NULL;

CREATE TRIGGER trg_raia_agent_registry_updated_at
    BEFORE UPDATE ON public.tbl_raia_agent_registry
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tbl_raia_agent_registry ENABLE ROW LEVEL SECURITY;
-- No policies on the base table → service-role only. Anonymous reads must go
-- through the curated view below.

CREATE OR REPLACE VIEW public.vw_raia_agent_registry_public
WITH (security_invoker = true) AS
SELECT
    agent_id,
    agent_card_url,
    name,
    display_name,
    logo_url,
    jurisdictions,
    capabilities,
    verification_status,
    trust_tier
FROM public.tbl_raia_agent_registry
WHERE revoked_at IS NULL
  AND verification_status = 'approved';

COMMENT ON VIEW public.vw_raia_agent_registry_public IS
    'Curated public view over tbl_raia_agent_registry. Hides notes, '
    'contact_*, companies_house_number, crawl telemetry. Only approved, '
    'non-revoked agents.';

GRANT SELECT ON public.vw_raia_agent_registry_public TO anon, authenticated;
