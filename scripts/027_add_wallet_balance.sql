-- Add wallet balance column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(18, 8) DEFAULT 0;

-- Update existing profiles with default balance (optional)
UPDATE public.profiles 
SET wallet_balance = 0 
WHERE wallet_balance IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.wallet_balance IS 'User HBAR balance tracked in the application';

-- Update handle_new_user function to include expertise and institution
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  -- Get the role from user metadata
  DECLARE
    user_role text := COALESCE(new.raw_user_meta_data->>'role', 'viewer');
    user_wallet_address text := new.raw_user_meta_data->>'wallet_address';
    user_expertise text := new.raw_user_meta_data->>'expertise';
    user_institution text := new.raw_user_meta_data->>'institution';
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
      institution,
      role, 
      expertise,
      wallet_address, 
      private_key,
      wallet_balance,
      created_at, 
      updated_at
    )
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'full_name', ''),
      COALESCE(user_institution, ''),
      user_role,
      COALESCE(user_expertise, ''),
      CASE 
        WHEN user_role = 'viewer' THEN NULL 
        ELSE user_wallet_address 
      END,
      CASE 
        WHEN user_role = 'viewer' THEN NULL 
        ELSE new.raw_user_meta_data->>'private_key' 
      END,
      0, -- Default wallet balance
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