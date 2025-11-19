-- Complete fix for infinite recursion in profiles RLS policy
-- This script removes all problematic policies and creates simple, safe ones

-- First, completely disable RLS temporarily to break any existing recursion
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on profiles table
DROP POLICY IF EXISTS profiles_own_select ON profiles;
DROP POLICY IF EXISTS profiles_authenticated_select ON profiles;
DROP POLICY IF EXISTS profiles_own_update ON profiles;
DROP POLICY IF EXISTS profiles_own_insert ON profiles;
DROP POLICY IF EXISTS profiles_admin_select ON profiles;
DROP POLICY IF EXISTS admin_user_management_select ON profiles;
DROP POLICY IF EXISTS profiles_select_own_or_public ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_insert_own ON profiles;

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create SIMPLE policies that don't cause recursion
-- Policy 1: Users can see their own profile
CREATE POLICY profiles_own ON profiles
  FOR ALL USING (auth.uid() = id);

-- Policy 2: Allow authenticated users to read basic profile info (for app functionality)
CREATE POLICY profiles_read_authenticated ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Also fix admin actions log to be simple
ALTER TABLE admin_actions_log DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_actions_log_select ON admin_actions_log;
DROP POLICY IF EXISTS admin_actions_log_insert ON admin_actions_log;

ALTER TABLE admin_actions_log ENABLE ROW LEVEL SECURITY;

-- Simple policy for admin logs - let application handle admin validation
CREATE POLICY admin_logs_authenticated ON admin_actions_log
  FOR ALL USING (auth.role() = 'authenticated');

-- Update admin dashboard function to not rely on RLS for admin check
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  stats JSON;
BEGIN
  -- Admin validation moved to application layer completely
  -- This function now just returns stats, app layer checks admin role
  
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'total_papers', (SELECT COUNT(*) FROM papers),
    'total_reviews', (SELECT COUNT(*) FROM reviews),
    'papers_by_status', (
      SELECT json_object_agg(status, count)
      FROM (
        SELECT status, COUNT(*) as count
        FROM papers
        GROUP BY status
      ) s
    ),
    'users_by_role', (
      SELECT json_object_agg(role, count)
      FROM (
        SELECT role, COUNT(*) as count
        FROM profiles
        GROUP BY role
      ) r
    ),
    'recent_submissions', (
      SELECT COUNT(*) FROM papers
      WHERE created_at >= NOW() - INTERVAL '7 days'
    ),
    'active_reviewers', (
      SELECT COUNT(*) FROM profiles
      WHERE role IN ('reviewer', 'admin')
    )
  ) INTO stats;

  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a simple function to safely get user profile
CREATE OR REPLACE FUNCTION get_user_profile(user_uuid UUID)
RETURNS TABLE(
  id UUID,
  email TEXT,
  full_name TEXT,
  institution TEXT,
  bio TEXT,
  role TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.email, p.full_name, p.institution, p.bio, p.role, p.created_at, p.updated_at
  FROM profiles p
  WHERE p.id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_profile(UUID) IS 'Safely get user profile without RLS recursion';

-- Log the fix
INSERT INTO admin_actions_log (action_type, description, performed_at)
VALUES ('rls_recursion_fixed', 'Fixed infinite recursion in profiles RLS policies', NOW());

-- Show current policies for verification
SELECT schemaname, tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('profiles', 'admin_actions_log')
ORDER BY tablename, policyname;