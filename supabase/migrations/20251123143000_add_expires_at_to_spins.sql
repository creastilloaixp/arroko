-- Add expires_at column to spins table
ALTER TABLE public.spins 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Update existing spins to have an expiration date (e.g., 30 days from creation)
UPDATE public.spins 
SET expires_at = created_at + INTERVAL '30 days' 
WHERE expires_at IS NULL;
