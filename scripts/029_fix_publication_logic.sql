-- Fix publication logic - publish papers that meet review requirements
-- This fixes papers that should be published but aren't due to flawed publication logic

-- First, let's see what papers should be published
-- (Papers with enough completed reviews but not yet published)

-- Update papers to published status when they have enough completed reviews
UPDATE public.papers 
SET 
  status = 'published',
  publication_date = CASE 
    WHEN publication_date IS NULL THEN NOW()
    ELSE publication_date
  END
WHERE status IN ('under-review', 'submitted')
AND id IN (
  SELECT p.id 
  FROM public.papers p
  INNER JOIN public.review_assignment_rules rar ON 1=1 -- Get the rule (assuming single rule)
  WHERE p.status IN ('under-review', 'submitted')
  AND (
    SELECT COUNT(DISTINCT rs.id)
    FROM public.review_assignments ra
    INNER JOIN public.review_submissions rs ON ra.id = rs.assignment_id
    WHERE ra.paper_id = p.id
    AND ra.status = 'completed'
    AND rs.status = 'completed'
  ) >= rar.reviewer_count -- Only publish when we have enough completed reviews
);

-- Also update corresponding submissions status
UPDATE public.submissions 
SET 
  status = 'published',
  updated_at = NOW()
WHERE status IN ('under-review', 'submitted')
AND paper_id IN (
  SELECT p.id 
  FROM public.papers p
  INNER JOIN public.review_assignment_rules rar ON 1=1
  WHERE p.status = 'published'
  AND (
    SELECT COUNT(DISTINCT rs.id)
    FROM public.review_assignments ra
    INNER JOIN public.review_submissions rs ON ra.id = rs.assignment_id
    WHERE ra.paper_id = p.id
    AND ra.status = 'completed'
    AND rs.status = 'completed'
  ) >= rar.reviewer_count
);