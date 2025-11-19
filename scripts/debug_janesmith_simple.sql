-- Simplified debug script for janesmith@gmail.com reviewer issue

-- Check janesmith profile details
SELECT 'JANESMITH_PROFILE' as section, 
       id, email, full_name, role, expertise, 
       CASE WHEN private_key IS NOT NULL THEN 'HAS_KEY' ELSE 'NO_KEY' END as key_status,
       created_at 
FROM public.profiles 
WHERE email = 'janesmith@gmail.com';

-- Check ALL submissions in the system and their status
SELECT 'ALL_SUBMISSIONS' as section,
       id, title, status, submitter_id, keywords, created_at
FROM public.submissions 
ORDER BY created_at DESC;

-- Check submissions with reviewable status
SELECT 'REVIEWABLE_STATUS_SUBMISSIONS' as section,
       s.id, s.title, s.status, s.submitter_id, s.keywords, 
       p.email as submitter_email
FROM public.submissions s
JOIN public.profiles p ON s.submitter_id = p.id
WHERE s.status IN ('under-review', 'submitted')
ORDER BY s.created_at DESC;

-- Simulate the exact dashboard query for janesmith
WITH janesmith_profile AS (
  SELECT id FROM public.profiles WHERE email = 'janesmith@gmail.com'
)
SELECT 'DASHBOARD_QUERY_RESULT' as section,
       s.id, s.title, s.status, s.submitter_id, s.keywords, 
       p.email as submitter_email,
       'AVAILABLE_FOR_JANESMITH' as result
FROM public.submissions s
JOIN public.profiles p ON s.submitter_id = p.id
CROSS JOIN janesmith_profile jp
WHERE s.status IN ('under-review', 'submitted')
  AND s.submitter_id != jp.id
ORDER BY s.created_at DESC;

-- Count summaries
SELECT 'SUMMARY_COUNTS' as section,
       COUNT(*) as total_submissions,
       COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted_status,
       COUNT(CASE WHEN status = 'under-review' THEN 1 END) as under_review_status,
       COUNT(CASE WHEN status IN ('under-review', 'submitted') THEN 1 END) as reviewable_status
FROM public.submissions;