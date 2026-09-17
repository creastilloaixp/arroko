ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;
ALTER TABLE public.spins ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

CREATE INDEX IF NOT EXISTS idx_participants_org_id ON public.participants(org_id);
CREATE INDEX IF NOT EXISTS idx_spins_org_id ON public.spins(org_id);

UPDATE public.participants SET org_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE org_id IS NULL;
UPDATE public.spins SET org_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE org_id IS NULL;