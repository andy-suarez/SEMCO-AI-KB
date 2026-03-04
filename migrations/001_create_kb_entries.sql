-- migrations/001_create_kb_entries.sql
-- Creates the kb_entries table for the SEMCO AI Knowledge Base.
-- Run this in Supabase Dashboard > SQL Editor.

CREATE TABLE IF NOT EXISTS kb_entries (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    question    TEXT        NOT NULL,
    answer      TEXT        NOT NULL,
    category    TEXT        NOT NULL DEFAULT '',
    products    TEXT[]      NOT NULL DEFAULT '{}',
    substrates  TEXT[]      NOT NULL DEFAULT '{}',
    source      TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_kb_entries_category ON kb_entries (category);

-- Index for source filtering (useful for dedup by origin)
CREATE INDEX IF NOT EXISTS idx_kb_entries_source ON kb_entries (source);

-- GIN indexes for array containment queries on products/substrates
CREATE INDEX IF NOT EXISTS idx_kb_entries_products ON kb_entries USING GIN (products);
CREATE INDEX IF NOT EXISTS idx_kb_entries_substrates ON kb_entries USING GIN (substrates);

-- Automatically update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON kb_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (Supabase best practice)
ALTER TABLE kb_entries ENABLE ROW LEVEL SECURITY;

-- Allow full access for service role key (our FastAPI backend)
CREATE POLICY "Service role full access" ON kb_entries
    FOR ALL
    USING (true)
    WITH CHECK (true);
