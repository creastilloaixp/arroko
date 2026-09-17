CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  org_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view feature flags" ON feature_flags;
CREATE POLICY "Admins can view feature flags" ON feature_flags
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage feature flags" ON feature_flags;
CREATE POLICY "Admins can manage feature flags" ON feature_flags
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Anon can read public flags" ON feature_flags;
CREATE POLICY "Anon can read public flags" ON feature_flags
  FOR SELECT USING (org_id IS NULL);