-- Add preferences column to participants table
ALTER TABLE participants 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Comment on column
COMMENT ON COLUMN participants.preferences IS 'Stores user preferences from onboarding (flavors, group size, etc.)';
