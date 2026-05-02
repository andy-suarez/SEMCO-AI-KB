-- migrations/006_unanswered_allow_manual_entries.sql
-- Tidio webhooks are gated behind a higher plan, so for now Andy will
-- paste unanswered questions into the admin UI manually. Manual entries
-- have no Tidio contact_id, so relax that NOT NULL constraint.
--
-- The unique (tidio_contact_id, tidio_solved_at) index is unaffected:
-- Postgres treats NULL values as distinct in unique indexes, so multiple
-- manual entries with NULL+NULL coexist without conflict, while genuine
-- webhook deliveries (with both fields set) still dedupe correctly.
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard > SQL Editor > New query
--   2. Paste this entire file
--   3. Click Run

BEGIN;

ALTER TABLE unanswered_questions
    ALTER COLUMN tidio_contact_id DROP NOT NULL;

COMMIT;
