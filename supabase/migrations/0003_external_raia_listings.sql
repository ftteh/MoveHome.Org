-- 0003_external_raia_listings.sql
--
-- Federated property listings cache. One row per (agent_id, raia_id) — the
-- crawler upserts on every poll of an agent's /api/raia/search.
--
-- Schema baselined against RAIA Protocol v0.2 (listing.json). Pricing fields
-- are whole-currency INTEGERS per v0.2 (not NUMERIC). Nested protocol blocks
-- (media, provenance, jurisdiction_extensions) stored as JSONB verbatim — the
-- crawler doesn't try to flatten them; the search UI reads what it needs.
--
-- The geography type lives in extensions schema (Supabase convention) — set
-- search_path so unqualified `geography(Point, 4326)` resolves. This mirrors
-- the postgis fix on raia main (commit 3b34dae).

SET search_path TO public, extensions;

CREATE TABLE public.tbl_external_raia_listings (
    -- ── Identity ────────────────────────────────────────────────────────────
    external_id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    source                   TEXT            NOT NULL DEFAULT 'raia_protocol'
                                CHECK (source = 'raia_protocol'),
    raia_schema_version      TEXT            NULL,                 -- '0.1' | '0.2' | ...

    agent_id                 TEXT            NOT NULL
                                REFERENCES public.tbl_raia_agent_registry(agent_id),
    raia_id                  TEXT            NOT NULL
                                CHECK (raia_id ~ '^prop-[a-z]{2}-[a-z0-9-]{2,32}-[0-9]{4,}$'),
    agent_card_url           TEXT            NULL,
    enquiry_endpoint         TEXT            NULL,

    -- ── Marketing copy ──────────────────────────────────────────────────────
    headline                 TEXT            NULL,
    marketing_description    TEXT            NULL,

    -- ── Property core ──────────────────────────────────────────────────────
    property_type            TEXT            NULL
                                CHECK (property_type IS NULL OR property_type IN
                                  ('flat', 'house', 'studio', 'commercial', 'land', 'other')),
    service_type             TEXT            NOT NULL
                                CHECK (service_type IN ('long_term', 'short_term', 'sale')),
    bedrooms                 INTEGER         NULL CHECK (bedrooms  IS NULL OR bedrooms  >= 0),
    bathrooms                INTEGER         NULL CHECK (bathrooms IS NULL OR bathrooms >= 0),
    floor_area_sqm           NUMERIC(10,2)   NULL CHECK (floor_area_sqm IS NULL OR floor_area_sqm >= 0),
    floor                    INTEGER         NULL,
    total_floors             INTEGER         NULL CHECK (total_floors IS NULL OR total_floors >= 1),
    furnishing               TEXT            NULL
                                CHECK (furnishing IS NULL OR furnishing IN
                                  ('furnished', 'unfurnished', 'part_furnished')),
    is_new_build             BOOLEAN         NULL,
    development_name         TEXT            NULL,

    -- ── Location ───────────────────────────────────────────────────────────
    location                 geography(Point, 4326) NULL,
    latitude                 NUMERIC(10,7)   NULL,
    longitude                NUMERIC(10,7)   NULL,
    postcode_full            TEXT            NULL,
    postcode_district        TEXT            NULL,
    postcode_sector          TEXT            NULL,
    street_name              TEXT            NULL,
    building_number          TEXT            NULL,
    suburb                   TEXT            NULL,
    un_locode                VARCHAR(5)      NULL
                                CHECK (un_locode IS NULL OR un_locode ~ '^[A-Z]{2}[A-Z0-9]{3}$'),
    jurisdiction             CHAR(2)         GENERATED ALWAYS AS (
                                CASE WHEN un_locode IS NULL THEN NULL
                                     ELSE LOWER(SUBSTRING(un_locode FROM 1 FOR 2))
                                END
                              ) STORED,

    -- ── Pricing (whole-currency integers per v0.2) ─────────────────────────
    rent_pcm                 INTEGER         NULL CHECK (rent_pcm     IS NULL OR rent_pcm     >= 0),
    daily_rate               INTEGER         NULL CHECK (daily_rate   IS NULL OR daily_rate   >= 0),
    asking_price             BIGINT          NULL CHECK (asking_price IS NULL OR asking_price >= 0),
    currency                 CHAR(3)         NULL
                                CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
    pricing_id               UUID            NULL,
    available_from           DATE            NULL,

    -- ── Status / distribution ──────────────────────────────────────────────
    listing_status           TEXT            NULL CHECK (listing_status IS NULL OR listing_status IN (
                                  'available', 'under_offer', 'let_agreed', 'sale_agreed',
                                  'exchanged', 'completed', 'fallen_through', 'withdrawn', 'paused'
                              )),
    visibility               TEXT            NOT NULL DEFAULT 'public'
                                CHECK (visibility IN ('public', 'pre_launch', 'off_market')),
    publish_from             TIMESTAMPTZ     NULL,
    publish_until            TIMESTAMPTZ     NULL,

    -- ── Features ───────────────────────────────────────────────────────────
    features                 TEXT[]          NULL,

    -- ── Nested protocol blocks (stored verbatim) ───────────────────────────
    media                    JSONB           NULL,    -- listing.json/media_block
    provenance               JSONB           NULL,    -- listing.json/provenance_block
    jurisdiction_extensions  JSONB           NULL,    -- listing.json/jurisdiction_extensions

    -- ── Convenience media columns (denormalised from `media` for UI lists) ─
    photo_url                TEXT            NULL,
    photo_count              INTEGER         NULL,

    -- ── Lifecycle ──────────────────────────────────────────────────────────
    listed_at                TIMESTAMPTZ     NULL,
    first_seen_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
    last_seen_at             TIMESTAMPTZ     NULL,
    withdrawn_at             TIMESTAMPTZ     NULL,

    -- ── Quality ────────────────────────────────────────────────────────────
    is_outlier               BOOLEAN         NOT NULL DEFAULT false,
    duplicate_of             UUID            NULL
                                REFERENCES public.tbl_external_raia_listings(external_id)
                                ON DELETE SET NULL,

    -- ── Audit ──────────────────────────────────────────────────────────────
    snapshot_version         INTEGER         NULL,
    synced_at                TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT uq_external_raia_listings_agent_raia_id UNIQUE (agent_id, raia_id)
);

COMMENT ON TABLE public.tbl_external_raia_listings IS
    'Federated property listings cached from RAIA Protocol agents. One row '
    'per (agent_id, raia_id). Crawler upserts on each /api/raia/search poll. '
    'Aligned with RAIA Protocol v0.2 listing.json — see '
    'estateaigents.org/schemas/listing.json.';

COMMENT ON COLUMN public.tbl_external_raia_listings.media IS
    'Verbatim media block from listing.json (photo_url, photos[], '
    'featured_image_url, floor_plan_url, video_url, tour_360_url).';

COMMENT ON COLUMN public.tbl_external_raia_listings.jurisdiction_extensions IS
    'Verbatim {gb: {...}, th: {...}} from listing.json. Read at query time '
    'rather than flattened into columns — keeps the table jurisdiction-neutral.';

-- ── Indexes ────────────────────────────────────────────────────────────────
-- Active-listings predicate is repeated in indexes so query planner can use
-- partial indexes when filters match.

CREATE INDEX idx_external_raia_listings_location
    ON public.tbl_external_raia_listings USING GIST (location)
    WHERE withdrawn_at IS NULL AND duplicate_of IS NULL AND is_outlier = false;

CREATE INDEX idx_external_raia_listings_search
    ON public.tbl_external_raia_listings
    (jurisdiction, postcode_district, service_type, bedrooms, rent_pcm)
    WHERE withdrawn_at IS NULL AND duplicate_of IS NULL AND is_outlier = false;

CREATE INDEX idx_external_raia_listings_agent
    ON public.tbl_external_raia_listings (agent_id);

CREATE INDEX idx_external_raia_listings_raia_id
    ON public.tbl_external_raia_listings (raia_id);

CREATE INDEX idx_external_raia_listings_features
    ON public.tbl_external_raia_listings USING GIN (features)
    WHERE withdrawn_at IS NULL AND duplicate_of IS NULL AND is_outlier = false;

CREATE INDEX idx_external_raia_listings_un_locode
    ON public.tbl_external_raia_listings (un_locode)
    WHERE withdrawn_at IS NULL AND duplicate_of IS NULL AND is_outlier = false;

ALTER TABLE public.tbl_external_raia_listings ENABLE ROW LEVEL SECURITY;

-- Public anon SELECT — only visible, non-withdrawn, non-duplicate, non-outlier
-- listings within their publish window.
CREATE POLICY tbl_external_raia_listings_anon_select
    ON public.tbl_external_raia_listings
    FOR SELECT TO anon, authenticated
    USING (
        withdrawn_at IS NULL
        AND duplicate_of IS NULL
        AND is_outlier = false
        AND visibility = 'public'
        AND (publish_from  IS NULL OR publish_from  <= now())
        AND (publish_until IS NULL OR publish_until >  now())
    );
