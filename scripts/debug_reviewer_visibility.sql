-- Debug script to check reviewer visibility issues
-- Run this to see what data is available

-- Check user profiles and roles
SELECT 'PROFILES' as section;
SELECT id, email, full_name, role, expertise, 
       CASE WHEN private_key IS NOT NULL THEN 'HAS_KEY' ELSE 'NO_KEY' END as key_status,
       created_at 
FROM public.profiles 
ORDER BY created_at DESC 
LIMIT 10;

-- Check submissions available for review
SELECT 'SUBMISSIONS' as section;
SELECT id, title, status, submitter_id, keywords, created_at
FROM public.submissions 
ORDER BY created_at DESC 
LIMIT 10;

-- Check review assignments
SELECT 'REVIEW_ASSIGNMENTS' as section;
SELECT id, paper_id, reviewer_id, status, assigned_at
FROM public.review_assignments 
ORDER BY assigned_at DESC NULLS LAST 
LIMIT 10;

-- Check if there are any submissions with status 'under-review' or 'submitted'
SELECT 'AVAILABLE_FOR_REVIEW' as section;
SELECT COUNT(*) as total_available,
       COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted_status,
       COUNT(CASE WHEN status = 'under-review' THEN 1 END) as under_review_status
FROM public.submissions 
WHERE status IN ('under-review', 'submitted');

-- Check reviewer role counts
SELECT 'REVIEWER_COUNTS' as section;
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN role = 'reviewer' THEN 1 END) as total_reviewers,
  COUNT(CASE WHEN role = 'reviewer' AND expertise IS NOT NULL THEN 1 END) as reviewers_with_expertise,
  COUNT(CASE WHEN role = 'reviewer' AND private_key IS NOT NULL THEN 1 END) as reviewers_with_keys
FROM public.profiles;

-- Show sample reviewer profiles
SELECT 'SAMPLE_REVIEWERS' as section;
SELECT id, email, full_name, expertise, 
       CASE WHEN private_key IS NOT NULL THEN 'HAS_KEY' ELSE 'NO_KEY' END as key_status
FROM public.profiles 
WHERE role = 'reviewer' 
LIMIT 5;

-- Check staking status for reviewers
SELECT 'STAKING_STATUS' as section;
SELECT p.email, p.full_name, s.staked_amount, s.created_at as staked_at
FROM public.profiles p
LEFT JOIN public.staking s ON p.id = s.reviewer_id
WHERE p.role = 'reviewer'
ORDER BY s.staked_amount DESC NULLS LAST
LIMIT 10;