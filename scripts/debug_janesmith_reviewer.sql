-- Debug script specifically for janesmith@gmail.com reviewer issue

-- Check janesmith profile details
SELECT 'JANESMITH_PROFILE' as section;
SELECT id, email, full_name, role, expertise, 
       CASE WHEN private_key IS NOT NULL THEN 'HAS_KEY' ELSE 'NO_KEY' END as key_status,
       created_at 
FROM public.profiles 
WHERE email = 'janesmith@gmail.com';

-- Check all submissions in the system
SELECT 'ALL_SUBMISSIONS' as section;
SELECT id, title, status, submitter_id, keywords, created_at,
       CASE 
         WHEN submitter_id = (SELECT id FROM public.profiles WHERE email = 'janesmith@gmail.com') 
         THEN 'SUBMITTED_BY_JANESMITH' 
         ELSE 'OTHER_SUBMITTER' 
       END as submitter_relation
FROM public.submissions 
ORDER BY created_at DESC;

-- Check what submissions should be available to janesmith (dashboard query simulation)
SELECT 'AVAILABLE_TO_JANESMITH' as section;
SELECT s.id, s.title, s.status, s.submitter_id, s.keywords, 
       p.email as submitter_email,
       CASE 
         WHEN s.submitter_id = (SELECT id FROM public.profiles WHERE email = 'janesmith@gmail.com') 
         THEN 'EXCLUDED_OWN_PAPER' 
         ELSE 'ELIGIBLE' 
       END as availability
FROM public.submissions s
JOIN public.profiles p ON s.submitter_id = p.id
WHERE s.status IN ('under-review', 'submitted')
  AND s.submitter_id != (SELECT id FROM public.profiles WHERE email = 'janesmith@gmail.com')
ORDER BY s.created_at DESC;

-- Check if janesmith has any existing review assignments
SELECT 'JANESMITH_ASSIGNMENTS' as section;
SELECT ra.id, ra.paper_id, ra.status, ra.assigned_at,
       s.title as paper_title
FROM public.review_assignments ra
LEFT JOIN public.submissions s ON ra.paper_id = s.id
WHERE ra.reviewer_id = (SELECT id FROM public.profiles WHERE email = 'janesmith@gmail.com')
ORDER BY ra.assigned_at DESC NULLS LAST;

-- Check the exact logic that dashboard uses
SELECT 'DASHBOARD_LOGIC_CHECK' as section;
SELECT 
  'Total submissions' as metric,
  COUNT(*) as value
FROM public.submissions

UNION ALL

SELECT 
  'Submissions under-review or submitted' as metric,
  COUNT(*) as value
FROM public.submissions 
WHERE status IN ('under-review', 'submitted')

UNION ALL

SELECT 
  'Papers NOT submitted by janesmith' as metric,
  COUNT(*) as value
FROM public.submissions 
WHERE status IN ('under-review', 'submitted')
  AND submitter_id != (SELECT id FROM public.profiles WHERE email = 'janesmith@gmail.com')

UNION ALL

SELECT 
  'Janesmith role check' as metric,
  CASE WHEN role = 'reviewer' THEN 1 ELSE 0 END as value
FROM public.profiles 
WHERE email = 'janesmith@gmail.com';