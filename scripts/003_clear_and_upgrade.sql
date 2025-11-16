-- Clear all data and upgrade schema to properly handle wallet_address and role in profiles

-- Disable all RLS policies temporarily
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_verifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staking DISABLE ROW LEVEL SECURITY;

-- Delete all data
DELETE FROM public.wallet_transactions;
DELETE FROM public.staking;
DELETE FROM public.review_submissions;
DELETE FROM public.review_assignments;
DELETE FROM public.reviews;
DELETE FROM public.blockchain_verifications;
DELETE FROM public.submissions;
DELETE FROM public.papers;
DELETE FROM public.profiles;

-- Add role and update wallet_address constraint if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'viewer';

-- Drop existing trigger and recreate with wallet_address and role support
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, wallet_address, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(new.raw_user_meta_data ->> 'wallet_address', ''),
    COALESCE(new.raw_user_meta_data ->> 'role', 'viewer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staking ENABLE ROW LEVEL SECURITY;
