-- migrations/012_add_is_admin_to_permissions.sql
-- Adds is_admin so one or more users can manage everyone else's
-- permissions through the new admin UI without us inventing a full
-- role system yet. Defaults to false; admin-only toggles handled
-- by the backend's require_admin dependency.
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard > SQL Editor > New query
--   2. Paste this entire file
--   3. Click Run
--
-- After running, designate yourself as admin (replace the UUID):
--   INSERT INTO user_permissions (user_id, can_delete_kb, can_sync_lyro, is_admin)
--   VALUES ('<your-uuid-from-supabase-auth>', true, true, true)
--   ON CONFLICT (user_id) DO UPDATE SET
--     can_delete_kb = EXCLUDED.can_delete_kb,
--     can_sync_lyro = EXCLUDED.can_sync_lyro,
--     is_admin      = EXCLUDED.is_admin;

BEGIN;

ALTER TABLE user_permissions
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

COMMIT;
