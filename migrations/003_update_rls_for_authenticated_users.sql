-- migrations/003_update_rls_for_authenticated_users.sql
-- Replace the catch-all RLS policy with an authenticated-users-only policy.
--
-- BEFORE: "Service role full access" applied to ALL roles (no TO clause),
-- which technically permitted the anon role to read kb_entries via the
-- anon key. Backend was OK because it uses service_role (which bypasses
-- RLS), but the policy was wider than intended.
--
-- AFTER:
--   - authenticated role  -> full access (used by the React admin UI)
--   - anon role           -> NO access  (no policy applies, RLS denies)
--   - service_role        -> bypasses RLS (used by FastAPI, scripts)
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard > SQL Editor > New query
--   2. Paste this entire file
--   3. Click Run
--
-- The whole thing runs in a transaction — partial failure rolls back.

BEGIN;

DROP POLICY IF EXISTS "Service role full access" ON kb_entries;

CREATE POLICY "Authenticated users full access" ON kb_entries
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

COMMIT;

-- Verify after running:
--   SELECT polname, polroles::regrole[] FROM pg_policy
--   WHERE polrelid = 'kb_entries'::regclass;
-- Expected: one row, polname = 'Authenticated users full access',
--           polroles containing the 'authenticated' role.
