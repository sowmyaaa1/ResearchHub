-- Fix papers that were prematurely published with insufficient reviews
-- Revert papers back to 'under-review' if they don't have enough completed reviews

UPDATE public.papers 
SET 
  status = 'under-review',
  publication_date = NULL
WHERE status = 'published'
AND id NOT IN (
  SELECT p.id 
  FROM public.papers p
  INNER JOIN public.review_assignment_rules rar ON 1=1 -- Get the rule (assuming single rule)
  WHERE p.status = 'published'
  AND (
    SELECT COUNT(DISTINCT rs.id)
    FROM public.review_assignments ra
    INNER JOIN public.review_submissions rs ON ra.id = rs.assignment_id
    WHERE ra.paper_id = p.id
    AND ra.status = 'completed'
    AND rs.status = 'completed'
  ) >= rar.reviewer_count -- Keep only papers with sufficient reviews
);

-- Also update corresponding submissions status to match
UPDATE public.submissions 
SET 
  status = 'under-review',
  updated_at = NOW()
WHERE status = 'published'
AND paper_id IN (
  SELECT id FROM public.papers WHERE status = 'under-review'
);