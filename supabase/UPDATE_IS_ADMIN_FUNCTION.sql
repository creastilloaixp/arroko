-- Update is_admin() function to be more robust
-- This function is used by other RLS policies

DROP FUNCTION IF EXISTS is_admin();

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS
AS $$
DECLARE
  admin_exists BOOLEAN;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user exists in admin_users table
  SELECT EXISTS (
    SELECT 1
    FROM admin_users
    WHERE user_id = auth.uid()
  ) INTO admin_exists;

  RETURN admin_exists;
EXCEPTION
  WHEN OTHERS THEN
    -- If any error occurs, return false for safety
    RETURN FALSE;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO anon;

-- Test the function (optional)
SELECT is_admin() AS is_current_user_admin;
