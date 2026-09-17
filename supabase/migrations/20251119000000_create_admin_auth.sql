-- Migration: Create Admin Authentication System
-- This replaces the hardcoded password with proper Supabase Auth

-- Step 1: Create admin_users table to track admin roles
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Step 2: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- Step 3: Enable RLS on admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for admin_users
DROP POLICY IF EXISTS "Admins can view their own record" ON admin_users;
CREATE POLICY "Admins can view their own record" ON admin_users
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all admin users" ON admin_users;
CREATE POLICY "Service role can manage all admin users" ON admin_users
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Step 5: Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admin_users
        WHERE user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Update existing tables to add admin-only policies

-- Participants: Admins can view all
DROP POLICY IF EXISTS "Admins can view all participants" ON participants;
CREATE POLICY "Admins can view all participants" ON participants
    FOR SELECT USING (is_admin());

-- Spins: Admins can view and update all
DROP POLICY IF EXISTS "Admins can view all spins" ON spins;
CREATE POLICY "Admins can view all spins" ON spins
    FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update spins" ON spins;
CREATE POLICY "Admins can update spins" ON spins
    FOR UPDATE USING (is_admin());

-- WhatsApp Messages: Admins can view all
DROP POLICY IF EXISTS "Admins can view all whatsapp messages" ON whatsapp_messages;
CREATE POLICY "Admins can view all whatsapp messages" ON whatsapp_messages
    FOR SELECT USING (is_admin());

-- Reservations: Admins can view and manage all
DROP POLICY IF EXISTS "Admins can view all reservations" ON reservations;
CREATE POLICY "Admins can view all reservations" ON reservations
    FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update reservations" ON reservations;
CREATE POLICY "Admins can update reservations" ON reservations
    FOR UPDATE USING (is_admin());

-- Restaurant Settings: Admins can view and update
DROP POLICY IF EXISTS "Admins can view restaurant settings" ON restaurant_settings;
CREATE POLICY "Admins can view restaurant settings" ON restaurant_settings
    FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update restaurant settings" ON restaurant_settings;
CREATE POLICY "Admins can update restaurant settings" ON restaurant_settings
    FOR UPDATE USING (is_admin());

-- Step 7: Create trigger for updated_at
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Create function to register first admin (run manually after migration)
-- IMPORTANT: After running this migration, create your first admin user with:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Create a new user with email/password
-- 3. Copy the user ID
-- 4. Run: INSERT INTO admin_users (user_id, role) VALUES ('YOUR_USER_ID', 'admin');

COMMENT ON TABLE admin_users IS 'Stores admin user roles. Link auth.users to admin privileges.';
COMMENT ON FUNCTION is_admin() IS 'Helper function to check if current user is an admin.';
