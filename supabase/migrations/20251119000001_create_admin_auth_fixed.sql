-- Migration: Create Admin Authentication System (Fixed Version)
-- This replaces the hardcoded password with proper Supabase Auth
-- Execute this script in Supabase SQL Editor

-- =====================================================
-- PART 1: Create admin_users table
-- =====================================================

-- Drop existing table if it exists (for clean migration)
DROP TABLE IF EXISTS admin_users CASCADE;

-- Create admin_users table to track admin roles
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'moderator', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);

-- Add comment for documentation
COMMENT ON TABLE admin_users IS 'Stores admin user roles. Links auth.users to admin privileges.';
COMMENT ON COLUMN admin_users.user_id IS 'References auth.users(id) - the Supabase Auth user ID';

-- =====================================================
-- PART 2: Enable Row Level Security
-- =====================================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view their own record
DROP POLICY IF EXISTS "Admins can view their own record" ON admin_users;
CREATE POLICY "Admins can view their own record" ON admin_users
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Service role can manage all (for migrations and admin tools)
DROP POLICY IF EXISTS "Service role can manage all admin users" ON admin_users;
CREATE POLICY "Service role can manage all admin users" ON admin_users
    FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- PART 3: Create helper function to check admin status
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS is_admin();

-- Create function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if the current authenticated user exists in admin_users table
    RETURN EXISTS (
        SELECT 1
        FROM admin_users
        WHERE user_id = auth.uid()
    );
EXCEPTION
    WHEN OTHERS THEN
        -- If any error occurs, return false (not admin)
        RETURN FALSE;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION is_admin() IS 'Helper function to check if current user has admin privileges';

-- =====================================================
-- PART 4: Create trigger for updated_at
-- =====================================================

-- Ensure update_updated_at_column function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for admin_users
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PART 5: Update RLS policies for existing tables
-- =====================================================

-- Participants: Allow admins to view all
DROP POLICY IF EXISTS "Admins can view all participants" ON participants;
CREATE POLICY "Admins can view all participants" ON participants
    FOR SELECT
    USING (is_admin());

-- Spins: Allow admins to view and update all
DROP POLICY IF EXISTS "Admins can view all spins" ON spins;
CREATE POLICY "Admins can view all spins" ON spins
    FOR SELECT
    USING (is_admin());

DROP POLICY IF EXISTS "Admins can update spins" ON spins;
CREATE POLICY "Admins can update spins" ON spins
    FOR UPDATE
    USING (is_admin());

-- WhatsApp Messages: Allow admins to view all
DROP POLICY IF EXISTS "Admins can view all whatsapp messages" ON whatsapp_messages;
CREATE POLICY "Admins can view all whatsapp messages" ON whatsapp_messages
    FOR SELECT
    USING (is_admin());

-- Reservations: Allow admins to view and manage all
DROP POLICY IF EXISTS "Admins can view all reservations" ON reservations;
CREATE POLICY "Admins can view all reservations" ON reservations
    FOR SELECT
    USING (is_admin());

DROP POLICY IF EXISTS "Admins can update reservations" ON reservations;
CREATE POLICY "Admins can update reservations" ON reservations
    FOR UPDATE
    USING (is_admin());

-- Restaurant Settings: Allow admins to view and update
DROP POLICY IF EXISTS "Admins can view restaurant settings" ON restaurant_settings;
CREATE POLICY "Admins can view restaurant settings" ON restaurant_settings
    FOR SELECT
    USING (is_admin());

DROP POLICY IF EXISTS "Admins can update restaurant settings" ON restaurant_settings;
CREATE POLICY "Admins can update restaurant settings" ON restaurant_settings
    FOR UPDATE
    USING (is_admin());

-- =====================================================
-- PART 6: Verification query
-- =====================================================

-- Test the setup (you can run this separately)
DO $$
BEGIN
    RAISE NOTICE '✅ Admin authentication system created successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Next steps:';
    RAISE NOTICE '1. Go to Supabase Dashboard > Authentication > Users';
    RAISE NOTICE '2. Create a new user or use an existing one';
    RAISE NOTICE '3. Copy the user ID';
    RAISE NOTICE '4. Run: INSERT INTO admin_users (user_id) VALUES (''YOUR_USER_ID'');';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 To verify your admin users, run:';
    RAISE NOTICE 'SELECT id, user_id, role, created_at FROM admin_users;';
END $$;
