-- Select all rows from each table in the ResearchHub database
-- WARNING: This will return all data - use with caution on large databases

-- ==============================================
-- CORE USER & PROFILE DATA
-- ==============================================

-- Auth users table
SELECT 'auth.users' as table_name;
SELECT * FROM auth.users;

-- Profiles table
SELECT 'public.profiles' as table_name;
SELECT * FROM public.profiles;

-- ==============================================
-- PAPER SUBMISSION & REVIEW WORKFLOW
-- ==============================================

-- Submissions table
SELECT 'public.submissions' as table_name;
SELECT * FROM public.submissions;

-- Papers table
SELECT 'public.papers' as table_name;
SELECT * FROM public.papers;

-- Review assignments table
SELECT 'public.review_assignments' as table_name;
SELECT * FROM public.review_assignments;

-- Reviews table
SELECT 'public.reviews' as table_name;
SELECT * FROM public.reviews;

-- Review submissions table
SELECT 'public.review_submissions' as table_name;
SELECT * FROM public.review_submissions;

-- ==============================================
-- BLOCKCHAIN & FINANCIAL DATA
-- ==============================================

-- Staking table
SELECT 'public.staking' as table_name;
SELECT * FROM public.staking;

-- Transactions table
SELECT 'public.transactions' as table_name;
SELECT * FROM public.transactions;

-- ==============================================
-- CONFIGURATION & ADMIN DATA
-- ==============================================

-- Review assignment rules table
SELECT 'public.review_assignment_rules' as table_name;
SELECT * FROM public.review_assignment_rules;

-- Admin audit log table
SELECT 'public.admin_audit_log' as table_name;
SELECT * FROM public.admin_audit_log;