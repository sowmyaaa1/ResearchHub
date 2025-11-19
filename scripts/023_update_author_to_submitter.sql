-- Migration 023: Update all "author" roles to "submitter" to maintain 4-role system
-- This ensures consistency across the platform with viewer, submitter, reviewer, admin roles

-- First, check current role distribution
SELECT role, COUNT(*) as count 
FROM public.profiles 
WHERE role IS NOT NULL 
GROUP BY role;

-- STEP 1: Drop the existing constraints that are blocking the update
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS valid_roles;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- STEP 2: Now update all "author" roles to "submitter" (constraints are removed)
UPDATE public.profiles 
SET 
    role = 'submitter',
    updated_at = now()
WHERE role = 'author';

-- STEP 3: Check the update results
SELECT role, COUNT(*) as count 
FROM public.profiles 
WHERE role IS NOT NULL 
GROUP BY role;

-- STEP 4: Add a constraint to ensure only valid roles are used going forward
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('viewer', 'submitter', 'reviewer', 'admin'));

-- Update any default role references in functions
-- Update the handle_new_user function to use 'submitter' instead of 'author' if needed
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    role, 
    wallet_address, 
    private_key,
    created_at, 
    updated_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    CASE 
        WHEN new.raw_user_meta_data->>'role' = 'author' THEN 'submitter'
        ELSE COALESCE(new.raw_user_meta_data->>'role', 'viewer')
    END,
    new.raw_user_meta_data->>'wallet_address',
    new.raw_user_meta_data->>'private_key',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    role = CASE 
        WHEN EXCLUDED.role = 'author' THEN 'submitter'
        ELSE COALESCE(EXCLUDED.role, profiles.role)
    END,
    wallet_address = COALESCE(EXCLUDED.wallet_address, profiles.wallet_address),
    private_key = COALESCE(EXCLUDED.private_key, profiles.private_key),
    updated_at = now();
    
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and continue
    RAISE WARNING 'Failed to create profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the migration completed successfully
SELECT 
    'Migration completed successfully.' as message,
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN role = 'submitter' THEN 1 END) as submitters,
    COUNT(CASE WHEN role = 'author' THEN 1 END) as authors_remaining
FROM public.profiles;