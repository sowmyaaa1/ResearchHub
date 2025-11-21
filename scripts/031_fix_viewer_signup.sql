-- Migration: Fix viewer signup to handle wallet validation properly
-- This script creates a new handle_new_user function that checks for role and validates accordingly

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  -- Get the role from user metadata
  DECLARE
    user_role text := COALESCE(new.raw_user_meta_data->>'role', 'viewer');
    user_wallet_address text := new.raw_user_meta_data->>'wallet_address';
    existing_wallet_count integer := 0;
  BEGIN
    -- Only check wallet address uniqueness for non-viewer roles
    IF user_role != 'viewer' AND user_wallet_address IS NOT NULL THEN
      -- Check if wallet address already exists
      SELECT COUNT(*) INTO existing_wallet_count
      FROM public.profiles 
      WHERE wallet_address = user_wallet_address;
      
      IF existing_wallet_count > 0 THEN
        RAISE EXCEPTION 'Wallet address % is already registered to another account', user_wallet_address
          USING ERRCODE = '23505'; -- unique_violation error code
      END IF;
    END IF;
    
    -- Insert the new profile
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
      user_role,
      CASE 
        WHEN user_role = 'viewer' THEN NULL 
        ELSE user_wallet_address 
      END,
      CASE 
        WHEN user_role = 'viewer' THEN NULL 
        ELSE new.raw_user_meta_data->>'private_key' 
      END,
      now(),
      now()
    );
    
    RETURN new;
  END;
EXCEPTION
  WHEN unique_violation THEN
    -- Re-raise unique violations so they're caught by the application
    RAISE;
  WHEN OTHERS THEN
    -- Log other errors and continue
    RAISE WARNING 'Failed to create profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO anon, authenticated;