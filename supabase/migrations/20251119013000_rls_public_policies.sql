-- Participants
DROP POLICY IF EXISTS "Anon can insert participants" ON participants;
CREATE POLICY "Anon can insert participants" ON participants
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update participants" ON participants;
CREATE POLICY "Admins can update participants" ON participants
  FOR UPDATE USING (is_admin());

-- Spins
DROP POLICY IF EXISTS "Anon can insert spins" ON spins;
CREATE POLICY "Anon can insert spins" ON spins
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update spins" ON spins;
CREATE POLICY "Admins can update spins" ON spins
  FOR UPDATE USING (is_admin());

-- User Interactions
DROP POLICY IF EXISTS "Anon can insert interactions" ON user_interactions;
CREATE POLICY "Anon can insert interactions" ON user_interactions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view interactions" ON user_interactions;
CREATE POLICY "Admins can view interactions" ON user_interactions
  FOR SELECT USING (is_admin());