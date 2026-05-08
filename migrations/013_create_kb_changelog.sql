-- migrations/013_create_kb_changelog.sql
-- Audit log for kb_entries: every INSERT/UPDATE/DELETE writes a row
-- via a Postgres trigger so we capture changes regardless of whether
-- they came through the React UI (Supabase client + auth.uid()) or
-- through the FastAPI backend (service_role; actor_user_id ends up
-- null in that path, which we surface as "system" in the UI).
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard > SQL Editor > New query
--   2. Paste this entire file
--   3. Click Run

BEGIN;

CREATE TABLE IF NOT EXISTS kb_changelog (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kb_entry_id     BIGINT,  -- nullable; DELETE orphans the FK
    action          TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    actor_user_id   UUID,
    snapshot        JSONB,        -- NEW row state for create/update, OLD for delete
    changed_fields  TEXT[],       -- update-only; field names that differ from previous state
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kb_changelog_occurred
    ON kb_changelog (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_kb_changelog_entry
    ON kb_changelog (kb_entry_id, occurred_at DESC);

-- Trigger function: fired AFTER each INSERT/UPDATE/DELETE on kb_entries.
-- auth.uid() returns the calling user's UUID when the change came from
-- a Supabase JS client request; returns NULL when service_role drives
-- the change (e.g. the FastAPI promote endpoint, scripts).
CREATE OR REPLACE FUNCTION log_kb_entry_change()
RETURNS TRIGGER AS $$
DECLARE
    diff TEXT[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO kb_changelog (kb_entry_id, action, actor_user_id, snapshot)
        VALUES (NEW.id, 'create', auth.uid(), to_jsonb(NEW));
        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Diff fields between OLD and NEW, ignoring updated_at since the
        -- existing trigger always bumps it.
        SELECT ARRAY(
            SELECT key
            FROM jsonb_each(to_jsonb(NEW)) AS new_kv(key, val)
            WHERE val IS DISTINCT FROM (to_jsonb(OLD)->key)
              AND key NOT IN ('updated_at')
        ) INTO diff;

        -- Skip empty-diff updates (e.g. a no-op save).
        IF array_length(diff, 1) > 0 THEN
            INSERT INTO kb_changelog (kb_entry_id, action, actor_user_id, snapshot, changed_fields)
            VALUES (NEW.id, 'update', auth.uid(), to_jsonb(NEW), diff);
        END IF;
        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO kb_changelog (kb_entry_id, action, actor_user_id, snapshot)
        VALUES (OLD.id, 'delete', auth.uid(), to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS kb_entries_changelog_trigger ON kb_entries;

CREATE TRIGGER kb_entries_changelog_trigger
AFTER INSERT OR UPDATE OR DELETE ON kb_entries
FOR EACH ROW EXECUTE FUNCTION log_kb_entry_change();

-- RLS: belt-and-suspenders. The FastAPI changelog endpoint enforces
-- admin-only via require_admin, but if anything ever queries this
-- table from the browser via the anon key, RLS still gates it.
ALTER TABLE kb_changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read kb_changelog" ON kb_changelog
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_permissions
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

COMMIT;
