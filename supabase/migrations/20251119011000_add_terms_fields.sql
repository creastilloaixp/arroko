ALTER TABLE participants ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS terms_version TEXT;