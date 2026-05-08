-- 0001_extensions_and_helpers.sql
--
-- Bootstraps the database with:
--   1. PostGIS in the dedicated `extensions` schema (Supabase convention —
--      avoids polluting `public` and silences the "extension in public schema"
--      security advisor).
--   2. A shared `set_updated_at()` trigger function used by every table that
--      tracks an updated_at column.

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
    'BEFORE UPDATE trigger function — stamps NEW.updated_at = now().';
