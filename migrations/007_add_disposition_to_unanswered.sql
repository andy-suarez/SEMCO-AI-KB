-- migrations/007_add_disposition_to_unanswered.sql
-- When dismissing an unanswered question, the reviewer must record WHY
-- (test entry, off-topic, inappropriate, duplicate, too ambiguous).
-- Dismissed rows already stay in the table; this just adds the reason.
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard > SQL Editor > New query
--   2. Paste this entire file
--   3. Click Run

BEGIN;

ALTER TABLE unanswered_questions
    ADD COLUMN IF NOT EXISTS disposition TEXT
        CHECK (disposition IN (
            'test_entry',
            'not_semco_related',
            'inappropriate_or_unsafe',
            'duplicate_entry',
            'too_ambiguous'
        ));

-- Optional index for filtering dismissed entries by disposition.
CREATE INDEX IF NOT EXISTS idx_unanswered_disposition
    ON unanswered_questions (disposition)
    WHERE disposition IS NOT NULL;

COMMIT;
