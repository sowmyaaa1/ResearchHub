-- Manual Admin User Setup Script
-- Run this after the main migration completes successfully

-- Step 1: Find an existing user to promote to admin
-- Replace 'your-email@example.com' with the actual email of the user you want to make admin

DO $$
DECLARE
  user_record RECORD;
BEGIN
  -- Show current users and their roles
  RAISE NOTICE 'Current users in the system:';
  FOR user_record IN SELECT email, full_name, role FROM profiles ORDER BY created_at LOOP
    RAISE NOTICE 'Email: %, Name: %, Role: %', user_record.email, user_record.full_name, user_record.role;
  END LOOP;
END $$;

-- Step 2: Promote a user to admin (uncomment and modify this section)
/*
UPDATE profiles 
SET role = 'admin',
    updated_at = NOW()
WHERE email = 'your-email@example.com';  -- Replace with actual email

-- Log the admin promotion
INSERT INTO admin_actions_log (action_type, target_user_id, old_role, new_role, description, performed_at)
SELECT 
  'manual_admin_promotion',
  p.id,
  'viewer',  -- or whatever their previous role was
  'admin',
  'First admin user promoted manually during setup',
  NOW()
FROM profiles p 
WHERE p.email = 'your-email@example.com';  -- Replace with actual email

-- Confirm the admin user was created
SELECT 'Admin user created successfully' as status, email, full_name, role 
FROM profiles 
WHERE role = 'admin';
*/

-- Step 3: Alternative - Create admin user for an existing auth user
-- If you know the user ID from Supabase Auth, you can use this:
/*
UPDATE profiles 
SET role = 'admin',
    updated_at = NOW()
WHERE id = 'user-uuid-from-supabase-auth';  -- Replace with actual user ID

-- Confirm
SELECT 'Admin user updated successfully' as status, email, full_name, role 
FROM profiles 
WHERE role = 'admin';
*/