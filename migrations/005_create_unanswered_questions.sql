-- migrations/005_create_unanswered_questions.sql
-- Captures Lyro conversations that ended without Lyro fully answering
-- (handoff to operator, or inactive timeout). Populated by the Tidio
-- webhook receiver in app/routers/webhooks.py. Drained by the admin
-- UI: each entry is reviewed, then either Promoted to a kb_entries
-- row or Dismissed.
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard > SQL Editor > New query
--   2. Paste this entire file
--   3. Click Run

BEGIN;

CREATE TABLE IF NOT EXISTS unanswered_questions (
    id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tidio_contact_id         UUID         NOT NULL,
    tidio_event_received_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    tidio_solved_at          TIMESTAMPTZ,
    reason                   TEXT         CHECK (reason IN ('handoff', 'inactive', 'taken_over_by_operator')),
    contact_email            TEXT,
    conversation_url         TEXT,
    customer_messages        JSONB        NOT NULL DEFAULT '[]'::jsonb,
    status                   TEXT         NOT NULL DEFAULT 'pending'
                                          CHECK (status IN ('pending', 'promoted', 'dismissed')),
    promoted_kb_entry_id     BIGINT       REFERENCES kb_entries(id) ON DELETE SET NULL,
    draft_answer             TEXT,
    draft_category           TEXT,
    draft_products           TEXT[]       NOT NULL DEFAULT '{}',
    draft_substrates         TEXT[]       NOT NULL DEFAULT '{}',
    handled_at               TIMESTAMPTZ,
    handled_by               TEXT
);

-- Idempotency for webhook deliveries (Tidio retries on 5xx).
CREATE UNIQUE INDEX IF NOT EXISTS unanswered_questions_dedupe
    ON unanswered_questions (tidio_contact_id, tidio_solved_at);

-- For the UI's pending-count badge and default list view.
CREATE INDEX IF NOT EXISTS idx_unanswered_status_received
    ON unanswered_questions (status, tidio_event_received_at DESC);

ALTER TABLE unanswered_questions ENABLE ROW LEVEL SECURITY;

-- Authenticated team members manage the queue from the admin UI.
-- Promotion/dismissal flows through the FastAPI endpoint (service_role)
-- so we get a proper handled_by audit trail; this policy lets the UI
-- read for listing and supports any direct edits we add later.
CREATE POLICY "Authenticated full access" ON unanswered_questions
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

COMMIT;
