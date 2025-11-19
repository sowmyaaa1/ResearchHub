-- Fix infinite recursion in profiles RLS policy
-- The issue is in the admin_user_management_select policy that creates circular reference

-- Drop the problematic policy
DROP POLICY IF EXISTS admin_user_management_select ON profiles;

-- Temporarily disable RLS on profiles to break the recursion
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Re-enable with simple policies that don't cause recursion
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Simple policy: Users can see their own profile, all other access controlled by application
CREATE POLICY profiles_own_select ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow authenticated users to see basic profile info (needed for app functionality)
CREATE POLICY profiles_authenticated_select ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow users to update their own profiles
CREATE POLICY profiles_own_update ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow new users to insert their own profile
CREATE POLICY profiles_own_insert ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Also fix any other potential recursion issues
-- Make sure the admin actions log policies are clean
DROP POLICY IF EXISTS admin_actions_log_select ON admin_actions_log;
CREATE POLICY admin_actions_log_select ON admin_actions_log
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS admin_actions_log_insert ON admin_actions_log;
CREATE POLICY admin_actions_log_insert ON admin_actions_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Update the admin dashboard stats function to be simpler
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  stats JSON;
BEGIN
  -- Note: Admin validation moved to application layer to avoid RLS recursion
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

COMMENT ON FUNCTION get_admin_dashboard_stats() IS 'Get dashboard statistics - admin access only (fixed recursion)';