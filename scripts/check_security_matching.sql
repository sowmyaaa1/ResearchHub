-- Check reviewer assignment matching for security expertise
-- Based on assignment rule data and your profile

-- 1. Check your reviewer profile
SELECT 'YOUR_REVIEWER_PROFILE' as section,
       id, email, full_name, role, expertise, 
       CASE WHEN private_key IS NOT NULL THEN 'HAS_KEY' ELSE 'NO_KEY' END as key_status
FROM public.profiles 
WHERE id = '163148c1-800a-442d-82f2-968abb09a162';

-- 2. Check the current assignment rule
SELECT 'ASSIGNMENT_RULE' as section,
       id, keywords, expertise, reviewer_count, updated_at
FROM public.review_assignment_rules
WHERE id = 1;

-- 3. Check all submissions and their keywords for security matches
SELECT 'ALL_SUBMISSIONS_WITH_KEYWORDS' as section,
       s.id, s.title, s.status, s.keywords, s.submitter_id, s.created_at,
       p.email as submitter_email,
       p.expertise as submitter_expertise,
       -- Check if keywords contain security-related terms
       CASE 
         WHEN s.keywords::text ILIKE '%security%' OR 
              s.keywords::text ILIKE '%distributed%' OR
              s.keywords::text ILIKE '%multi-agent%' OR
              s.keywords::text ILIKE '%consensus%' OR
              s.title ILIKE '%security%' OR
              s.title ILIKE '%distributed%' OR
              s.title ILIKE '%multi-agent%' OR
              s.title ILIKE '%consensus%'
         THEN 'POTENTIAL_MATCH' 
         ELSE 'NO_MATCH' 
       END as keyword_match,
       CASE 
         WHEN s.submitter_id = '163148c1-800a-442d-82f2-968abb09a162' THEN 'YOUR_PAPER'
         ELSE 'OTHER_PAPER'
       END as ownership
FROM public.submissions s
LEFT JOIN public.profiles p ON s.submitter_id = p.id
ORDER BY s.created_at DESC;

-- 4. Check papers that should be available for review (excluding your own)
SELECT 'ELIGIBLE_PAPERS_FOR_YOU' as section,
       s.id, s.title, s.status, s.keywords, s.created_at,
       p.email as submitter_email,
       -- Security-related keyword matching
       CASE 
         WHEN s.keywords::text ILIKE '%security%' THEN 'EXACT_SECURITY_MATCH'
         WHEN s.keywords::text ILIKE '%distributed%' OR s.keywords::text ILIKE '%multi-agent%' OR s.keywords::text ILIKE '%consensus%' THEN 'RELATED_MATCH'
         ELSE 'NO_KEYWORD_MATCH'
       END as match_type
FROM public.submissions s
LEFT JOIN public.profiles p ON s.submitter_id = p.id
WHERE s.status IN ('under-review', 'submitted', 'draft')  -- Check draft too
  AND s.submitter_id != '163148c1-800a-442d-82f2-968abb09a162'  -- Exclude your papers
ORDER BY s.created_at DESC;

-- 5. Check if there are existing review assignments for any papers
SELECT 'EXISTING_REVIEW_ASSIGNMENTS' as section,
       ra.id, ra.paper_id, ra.reviewer_id, ra.status, ra.assigned_at,
       p.email as reviewer_email,
       s.title as paper_title,
       CASE 
         WHEN ra.reviewer_id = '163148c1-800a-442d-82f2-968abb09a162' THEN 'YOUR_ASSIGNMENT'
         ELSE 'OTHER_REVIEWER'
       END as assignment_type
FROM public.review_assignments ra
LEFT JOIN public.profiles p ON ra.reviewer_id = p.id
LEFT JOIN public.submissions s ON ra.paper_id = s.id
ORDER BY ra.assigned_at DESC NULLS LAST;

-- 6. Check what assignment-related tables exist
SELECT 'AVAILABLE_TABLES' as section,
       table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%review%' OR table_name LIKE '%assignment%' OR table_name LIKE '%expertise%'
ORDER BY table_name;