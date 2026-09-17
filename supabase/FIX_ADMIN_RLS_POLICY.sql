-- Fix Admin Users RLS Policy
-- This ensures authenticated users can check their admin status

-- Drop existing policy if any
DROP POLICY IF EXISTS "admin_users_policy" ON admin_users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON admin_users;
DROP POLICY IF EXISTS "Enable all access for service role" ON admin_users;

-- Enable RLS (if not already enabled)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create a permissive policy that allows authenticated users to read admin_users
-- This is needed so users can check if they are admins after logging in
CREATE POLICY "Allow authenticated users to read admin_users"
ON admin_users
FOR SELECT
TO authenticated
USING (true);

-- Create a policy for service role to manage everything
CREATE POLICY "Allow service role full access to admin_users"
ON admin_users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'admin_users';
