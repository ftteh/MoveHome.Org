-- 0005_advisor_fixes.sql
--
-- Applies the supabase database linter fixes flagged after 0001-0004.
--   1. function_search_path_mutable on public.set_updated_at — pin search_path.
--   2. anon/authenticated_security_definer_function_executable on
--      public.handle_new_user — revoke EXECUTE from anon + authenticated so it
--      cannot be called via /rest/v1/rpc. The trigger on auth.users still
--      fires because triggers don't go through the REST API.
--   3. auth_rls_initplan × 4 — wrap auth.uid() in (select auth.uid()) so the
--      planner evaluates it once per query rather than per row.
--   4. unindexed_foreign_keys on tbl_external_raia_listings.duplicate_of.

-- ── 1. set_updated_at: pinned search_path ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ── 2. handle_new_user: revoke direct EXECUTE ─────────────────────────────
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- ── 3. RLS policies: wrap auth.uid() ──────────────────────────────────────
DROP POLICY tbl_users_self_select ON public.tbl_users;
CREATE POLICY tbl_users_self_select ON public.tbl_users
    FOR SELECT TO authenticated USING (id = (select auth.uid()));

DROP POLICY tbl_users_self_update ON public.tbl_users;
CREATE POLICY tbl_users_self_update ON public.tbl_users
    FOR UPDATE TO authenticated
    USING (id = (select auth.uid()))
    WITH CHECK (id = (select auth.uid()));

DROP POLICY tbl_saved_searches_owner ON public.tbl_saved_searches;
CREATE POLICY tbl_saved_searches_owner ON public.tbl_saved_searches
    FOR ALL TO authenticated
    USING (user_id = (select auth.uid()))
    WITH CHECK (user_id = (select auth.uid()));

DROP POLICY tbl_enquiries_self_select ON public.tbl_enquiries;
CREATE POLICY tbl_enquiries_self_select ON public.tbl_enquiries
    FOR SELECT TO authenticated USING (user_id = (select auth.uid()));

-- ── 4. duplicate_of covering index ────────────────────────────────────────
CREATE INDEX idx_external_raia_listings_duplicate_of
    ON public.tbl_external_raia_listings (duplicate_of)
    WHERE duplicate_of IS NOT NULL;
