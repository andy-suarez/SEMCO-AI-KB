-- migrations/011_create_user_permissions.sql
-- Per-user feature toggles. Missing row = defaults applied in-code by
-- the backend (can_delete_kb=false, can_sync_lyro=false,
-- can_use_calculator=true, can_see_prices=true). To override for a
-- user, INSERT a row with the desired flags.
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard > SQL Editor > New query
--   2. Paste this entire file
--   3. Click Run
--
-- After running, give yourself admin powers (delete + sync) by
-- finding your user_id in Supabase Auth > Users and inserting:
--   INSERT INTO user_permissions (user_id, can_delete_kb, can_sync_lyro)
--   VALUES ('<your-user-id>', true, true)
--   ON CONFLICT (user_id) DO UPDATE SET
--     can_delete_kb = EXCLUDED.can_delete_kb,
--     can_sync_lyro = EXCLUDED.can_sync_lyro;

BEGIN;

CREATE TABLE IF NOT EXISTS user_permissions (
    user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    can_delete_kb      BOOLEAN NOT NULL DEFAULT false,
    can_sync_lyro      BOOLEAN NOT NULL DEFAULT false,
    can_use_calculator BOOLEAN NOT NULL DEFAULT true,
    can_see_prices     BOOLEAN NOT NULL DEFAULT true,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Each user reads only their own row. Service role bypasses RLS for
-- the backend's permission checks and admin SQL.
CREATE POLICY "Users read own permissions" ON user_permissions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

COMMIT;
