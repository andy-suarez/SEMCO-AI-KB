-- migrations/004_create_sync_log.sql
-- Tracks each Lyro sync run so the team can see when the KB was last
-- pushed to Lyro and by whom. Useful with multiple reviewers so two
-- people don't trigger overlapping syncs.
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard > SQL Editor > New query
--   2. Paste this entire file
--   3. Click Run

BEGIN;

CREATE TABLE IF NOT EXISTS sync_log (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    target          TEXT        NOT NULL CHECK (target IN ('lyro')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    total_entries   INTEGER     NOT NULL DEFAULT 0,
    succeeded       INTEGER     NOT NULL DEFAULT 0,
    failed          INTEGER     NOT NULL DEFAULT 0,
    triggered_by    TEXT,                                 -- email of the authenticated user
    error_summary   TEXT                                  -- short description if failed > 0
);

CREATE INDEX IF NOT EXISTS idx_sync_log_target_started
    ON sync_log (target, started_at DESC);

ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users in the admin UI can read all sync history.
CREATE POLICY "Authenticated users can read sync_log" ON sync_log
    FOR SELECT
    TO authenticated
    USING (true);

-- Writes happen only from the FastAPI service (service_role bypasses RLS).
-- No INSERT/UPDATE policy for the authenticated role on purpose.

COMMIT;

-- Verify after running:
--   SELECT polname, polroles::regrole[] FROM pg_policy
--   WHERE polrelid = 'sync_log'::regclass;
