-- Comprehensive database inspection script
-- This script fetches data from all tables in the ResearchHub database

-- ==============================================
-- CORE USER & PROFILE DATA
-- ==============================================

-- Users table (from auth schema)
SELECT 'auth.users' as table_name, count(*) as row_count FROM auth.users;
SELECT * FROM auth.users ORDER BY created_at DESC LIMIT 10;

-- Profiles table (main user data)
SELECT 'profiles' as table_name, count(*) as row_count FROM public.profiles;
SELECT 
  id, 
  email, 
  full_name, 
  role, 
  institution, 
  wallet_address,
  CASE 
    WHEN private_key IS NOT NULL THEN 'HAS_PRIVATE_KEY'
    ELSE 'NO_PRIVATE_KEY'
  END as private_key_status,
  reputation_score,
  created_at, 
  updated_at
FROM public.profiles 
ORDER BY created_at DESC;

-- ==============================================
-- PAPER SUBMISSION & REVIEW WORKFLOW
-- ==============================================

-- Submissions table (papers submitted by users)
SELECT 'submissions' as table_name, count(*) as row_count FROM public.submissions;
SELECT 
  id,
  submitter_id,
  title,
  LEFT(abstract, 100) || '...' as abstract_preview,
  keywords,
  status,
  pdf_url,
  created_at
FROM public.submissions 
ORDER BY created_at DESC;

-- Papers table (published/processed papers)
SELECT 'papers' as table_name, count(*) as row_count FROM public.papers;
SELECT 
  id,
  title,
  LEFT(abstract, 100) || '...' as abstract_preview,
  keywords,
  status,
  author_id,
  created_at
FROM public.papers 
ORDER BY created_at DESC;

-- Review assignments table
SELECT 'review_assignments' as table_name, count(*) as row_count FROM public.review_assignments;
SELECT 
  id,
  paper_id,
  reviewer_id,
  status,
  due_date,
  assigned_at,
  created_at
FROM public.review_assignments 
ORDER BY created_at DESC;

-- Reviews table (completed reviews)
SELECT 'reviews' as table_name, count(*) as row_count FROM public.reviews;
SELECT 
  id,
  paper_id,
  reviewer_id,
  rating,
  recommendation,
  LEFT(feedback, 100) || '...' as feedback_preview,
  reward_amount,
  created_at
FROM public.reviews 
ORDER BY created_at DESC;

-- Review submissions table
SELECT 'review_submissions' as table_name, count(*) as row_count FROM public.review_submissions;
SELECT 
  id,
  assignment_id,
  reviewer_id,
  submission_id,
  novelty_score,
  technical_correctness_score,
  clarity_score,
  significance_score,
  recommendation,
  LEFT(comments, 100) || '...' as comments_preview,
  status,
  created_at
FROM public.review_submissions 
ORDER BY created_at DESC;

-- ==============================================
-- BLOCKCHAIN & FINANCIAL DATA
-- ==============================================

-- Staking table (reviewer stakes)
SELECT 'staking' as table_name, count(*) as row_count FROM public.staking;
SELECT 
  id,
  reviewer_id,
  staked_amount,
  status,
  stake_tx_hash,
  unstake_tx_hash,
  created_at,
  updated_at
FROM public.staking 
ORDER BY created_at DESC;

-- Transactions table (blockchain transactions)
SELECT 'transactions' as table_name, count(*) as row_count FROM public.transactions;
SELECT 
  id,
  user_id,
  type,
  amount,
  hedera_tx_hash,
  status,
  description,
  created_at
FROM public.transactions 
ORDER BY created_at DESC;

-- ==============================================
-- CONFIGURATION & ADMIN DATA
-- ==============================================

-- Review assignment rules table
SELECT 'review_assignment_rules' as table_name, count(*) as row_count FROM public.review_assignment_rules;
SELECT 
  id,
  keywords,
  expertise,
  min_reviewers,
  max_reviewers,
  created_at,
  updated_at
FROM public.review_assignment_rules 
ORDER BY created_at DESC;

-- Admin audit log table
SELECT 'admin_audit_log' as table_name, count(*) as row_count FROM public.admin_audit_log;
SELECT 
  id,
  admin_id,
  action,
  target_type,
  target_id,
  details,
  created_at
FROM public.admin_audit_log 
ORDER BY created_at DESC 
LIMIT 20;

-- ==============================================
-- TABLE RELATIONSHIPS & SUMMARY
-- ==============================================

-- Summary of all table row counts
SELECT 
  'profiles' as table_name, 
  count(*) as total_rows,
  count(CASE WHEN role = 'viewer' THEN 1 END) as viewers,
  count(CASE WHEN role = 'submitter' THEN 1 END) as submitters,
  count(CASE WHEN role = 'reviewer' THEN 1 END) as reviewers,
  count(CASE WHEN role = 'admin' THEN 1 END) as admins
FROM public.profiles

UNION ALL

SELECT 
  'submissions' as table_name,
  count(*) as total_rows,
  count(CASE WHEN status = 'draft' THEN 1 END) as drafts,
  count(CASE WHEN status = 'submitted' THEN 1 END) as submitted,
  count(CASE WHEN status = 'under-review' THEN 1 END) as under_review,
  count(CASE WHEN status = 'published' THEN 1 END) as published
FROM public.submissions

UNION ALL

SELECT 
  'reviews' as table_name,
  count(*) as total_rows,
  count(CASE WHEN recommendation = 'accept' THEN 1 END) as accepts,
  count(CASE WHEN recommendation = 'reject' THEN 1 END) as rejects,
  0 as col3,
  0 as col4
FROM public.reviews

UNION ALL

SELECT 
  'staking' as table_name,
  count(*) as total_rows,
  ROUND(AVG(staked_amount), 2) as avg_stake,
  ROUND(SUM(staked_amount), 2) as total_staked,
  0 as col4
FROM public.staking

ORDER BY table_name;

-- ==============================================
-- USEFUL JOINS FOR DATA ANALYSIS
-- ==============================================

-- Users with their submission counts
SELECT 
  p.full_name,
  p.role,
  p.institution,
  COUNT(s.id) as submission_count,
  p.reputation_score
FROM public.profiles p
LEFT JOIN public.submissions s ON p.id = s.submitter_id
GROUP BY p.id, p.full_name, p.role, p.institution, p.reputation_score
ORDER BY submission_count DESC;

-- Reviews with reviewer and paper info
SELECT 
  r.id as review_id,
  reviewer.full_name as reviewer_name,
  p.title as paper_title,
  r.recommendation,
  r.rating,
  r.reward_amount,
  r.created_at
FROM public.reviews r
JOIN public.profiles reviewer ON r.reviewer_id = reviewer.id
LEFT JOIN public.papers p ON r.paper_id = p.id
ORDER BY r.created_at DESC
LIMIT 10;

-- ==============================================
-- DATABASE SCHEMA INSPECTION
-- ==============================================

-- List all tables and their column counts
SELECT 
  schemaname,
  tablename,
  tableowner,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables 
WHERE schemaname IN ('public', 'auth')
ORDER BY schemaname, tablename;

-- List all columns for main tables
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'submissions', 'papers', 'reviews', 
    'review_assignments', 'review_submissions', 
    'staking', 'transactions', 'review_assignment_rules'
  )
ORDER BY table_name, ordinal_position;