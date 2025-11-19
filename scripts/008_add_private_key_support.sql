-- Migration: Add private key support and update profile creation trigger
-- This script ensures that when users sign up, their profile is created with the private key

-- First, ensure the private_key column exists (it should based on the table schema you provided)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS private_key text;

-- Create or replace the function to handle new user signup
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
    COALESCE(new.raw_user_meta_data->>'role', 'viewer'),
    new.raw_user_meta_data->>'wallet_address',
    new.raw_user_meta_data->>'private_key',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    role = COALESCE(EXCLUDED.role, profiles.role),
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

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO anon, authenticated;

-- Add RLS (Row Level Security) policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profile info readable" ON public.profiles;

-- Policy to allow users to read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy to allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policy to allow reading public profile info (for reviewers, etc.)
CREATE POLICY "Public profile info readable" ON public.profiles
  FOR SELECT USING (true);

-- Make sure the profiles table has the correct structure
COMMENT ON COLUMN public.profiles.private_key IS 'Encrypted Hedera private key for blockchain transactions';
COMMENT ON TABLE public.profiles IS 'User profiles with Hedera blockchain integration';