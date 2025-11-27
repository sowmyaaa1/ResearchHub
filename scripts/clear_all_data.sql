-- Clear all user data and related information from ResearchHub database
-- WARNING: This will permanently delete ALL user data. Use with caution!

-- Disable foreign key checks temporarily (if needed)
SET session_replication_role = replica;

-- Clear all data in dependency order (child tables first, then parent tables)

-- 1. Clear review-related data
DELETE FROM public.review_submissions;
DELETE FROM public.reviewer_assignments;
DELETE FROM public.reviews;

-- 2. Clear paper-related data
DELETE FROM public.paper_citations;
DELETE FROM public.paper_views;
DELETE FROM public.papers;

-- 3. Clear wallet and transaction data
DELETE FROM public.wallet_transactions;
DELETE FROM public.staking_records;

-- 4. Clear user profile data
DELETE FROM public.profiles;

-- 5. Clear authentication data (Supabase auth schema)
-- Note: This might require elevated privileges
DELETE FROM auth.users CASCADE;
DELETE FROM auth.identities;
DELETE FROM auth.sessions;
DELETE FROM auth.refresh_tokens;

-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;

-- Reset sequences (auto-increment counters)
-- This ensures IDs start from 1 again for new records
ALTER SEQUENCE IF EXISTS public.papers_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.reviews_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.review_submissions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.reviewer_assignments_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.wallet_transactions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.staking_records_id_seq RESTART WITH 1;

-- Vacuum tables to reclaim space
VACUUM FULL public.profiles;
VACUUM FULL public.papers;
VACUUM FULL public.reviews;
VACUUM FULL public.review_submissions;
VACUUM FULL public.reviewer_assignments;
VACUUM FULL public.wallet_transactions;
VACUUM FULL public.staking_records;

-- Display confirmation
SELECT 'Database cleared successfully' as status;

-- Optional: Show row counts to verify deletion
SELECT 
  'profiles' as table_name, 
  count(*) as remaining_rows 
FROM public.profiles
UNION ALL
SELECT 
  'papers' as table_name, 
  count(*) as remaining_rows 
FROM public.papers
UNION ALL
SELECT 
  'reviews' as table_name, 
  count(*) as remaining_rows 
FROM public.reviews
UNION ALL
SELECT 
  'auth.users' as table_name, 
  count(*) as remaining_rows 
FROM auth.users;