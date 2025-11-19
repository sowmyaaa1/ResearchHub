-- Setup proper admin role management and security
-- This migration ensures only designated admins can access the admin dashboard

-- First, update any existing invalid role values to valid ones
UPDATE profiles 
SET role = CASE 
  WHEN role IS NULL THEN 'viewer'
  WHEN role = 'user' THEN 'author'  -- Convert 'user' to 'author'
  WHEN role NOT IN ('admin', 'reviewer', 'author', 'viewer') THEN 'viewer'
  ELSE role
END
WHERE role IS NULL OR role NOT IN ('admin', 'reviewer', 'author', 'viewer');

-- Now safely add the constraint
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'valid_roles' 
    AND table_name = 'profiles'
    AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE public.profiles 
    ADD CONSTRAINT valid_roles CHECK (role IN ('admin', 'reviewer', 'author', 'viewer'));
  END IF;
END $$;

-- Create admin management functions
CREATE OR REPLACE FUNCTION set_user_role(user_id UUID, new_role TEXT)
RETURNS VOID AS $$
BEGIN
  -- Validate role
  IF new_role NOT IN ('admin', 'reviewer', 'author', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: %. Valid roles are: admin, reviewer, author, viewer', new_role;
  END IF;
  
  -- Update user role
  UPDATE profiles 
  SET role = new_role,
      updated_at = NOW()
  WHERE id = user_id;
  
  -- Log the role change
  INSERT INTO admin_actions_log (action_type, target_user_id, new_role, performed_at)
  VALUES ('role_change', user_id, new_role, NOW());
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin actions audit log
CREATE TABLE IF NOT EXISTS admin_actions_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL,
  performed_by UUID REFERENCES profiles(id),
  target_user_id UUID REFERENCES profiles(id),
  old_role TEXT,
  new_role TEXT,
  description TEXT,
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Only create if table doesn't exist or is empty
DO $$
BEGIN
  -- Only add the initial log entry if table is new/empty
  IF NOT EXISTS (
    SELECT 1 FROM admin_actions_log WHERE action_type = 'system_setup'
  ) THEN
    INSERT INTO admin_actions_log (action_type, description, performed_at)
    VALUES ('system_setup', 'Admin role management system initialized', NOW());
  END IF;
END $$;

-- Create function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  p_action_type TEXT,
  p_performed_by UUID DEFAULT NULL,
  p_target_user_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO admin_actions_log (action_type, performed_by, target_user_id, description, performed_at)
  VALUES (p_action_type, p_performed_by, p_target_user_id, p_description, NOW())
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get admin dashboard stats securely
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  stats JSON;
BEGIN
  -- Only allow admins to access this function
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

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

-- Row Level Security for admin tables
DO $$
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'admin_actions_log' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE admin_actions_log ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Only admins can view admin action logs
DROP POLICY IF EXISTS admin_actions_log_select ON admin_actions_log;
CREATE POLICY admin_actions_log_select ON admin_actions_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can insert admin action logs  
DROP POLICY IF EXISTS admin_actions_log_insert ON admin_actions_log;
CREATE POLICY admin_actions_log_insert ON admin_actions_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create view for admin user management
DROP VIEW IF EXISTS admin_user_management;
CREATE VIEW admin_user_management AS
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.created_at,
  p.updated_at,
  COALESCE(paper_count.count, 0) as papers_submitted,
  COALESCE(review_count.count, 0) as reviews_completed,
  COALESCE(s.staked_amount, 0::DECIMAL(18,8)) as current_stake
FROM profiles p
LEFT JOIN (
  SELECT author_id, COUNT(*) as count
  FROM papers
  GROUP BY author_id
) paper_count ON p.id = paper_count.author_id
LEFT JOIN (
  SELECT reviewer_id, COUNT(*) as count
  FROM reviews
  WHERE rating IS NOT NULL
  GROUP BY reviewer_id
) review_count ON p.id = review_count.reviewer_id
LEFT JOIN staking s ON p.id = s.reviewer_id
ORDER BY p.created_at DESC;

-- Grant access to admin view only for admins
ALTER VIEW admin_user_management OWNER TO postgres;
GRANT SELECT ON admin_user_management TO authenticated;

-- Create RLS policy for admin view access
DROP POLICY IF EXISTS admin_user_management_select ON profiles;
CREATE POLICY admin_user_management_select ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Function to promote user to admin (requires existing admin)
CREATE OR REPLACE FUNCTION promote_to_admin(target_user_id UUID, performed_by UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if performer is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = performed_by AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Only admins can promote users to admin';
  END IF;
  
  -- Get current role for logging
  DECLARE
    old_role TEXT;
  BEGIN
    SELECT role INTO old_role FROM profiles WHERE id = target_user_id;
  END;
  
  -- Promote user
  UPDATE profiles 
  SET role = 'admin',
      updated_at = NOW()
  WHERE id = target_user_id;
  
  -- Log the action
  INSERT INTO admin_actions_log (
    action_type, performed_by, target_user_id, old_role, new_role, description
  ) VALUES (
    'promote_to_admin', performed_by, target_user_id, old_role, 'admin',
    'User promoted to admin role'
  );
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create initial admin user (update with actual admin email)
-- NOTE: Replace 'admin@researchhub.com' with actual admin email
DO $$
BEGIN
  -- Only create admin user if no admin exists and there's a matching auth user
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin') THEN
    -- This will only work if there's already a user signed up with this email
    -- You'll need to manually update an existing user's role to admin
    INSERT INTO admin_actions_log (action_type, description, performed_at)
    VALUES ('admin_setup_needed', 'No admin user found. Please manually promote a user to admin role.', NOW());
  END IF;
END $$;

-- Log admin setup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_actions_log WHERE action_type = 'system_setup_complete'
  ) THEN
    INSERT INTO admin_actions_log (action_type, description, performed_at)
    VALUES ('system_setup_complete', 'Admin role management system initialized successfully', NOW());
  END IF;
END $$;

COMMENT ON TABLE admin_actions_log IS 'Audit log for all administrative actions';
COMMENT ON FUNCTION set_user_role(UUID, TEXT) IS 'Safely change user role with audit logging';
COMMENT ON FUNCTION get_admin_dashboard_stats() IS 'Get dashboard statistics - admin access only';
COMMENT ON VIEW admin_user_management IS 'Admin view for user management with usage statistics';