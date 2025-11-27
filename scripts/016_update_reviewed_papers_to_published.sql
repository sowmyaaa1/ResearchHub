-- Update papers with completed reviews to published status
-- Only publish when the required number of reviews (per assignment rules) is reached
UPDATE public.papers 
SET 
  status = 'published',
  publication_date = CASE 
    WHEN publication_date IS NULL THEN NOW()
    ELSE publication_date
  END
WHERE id IN (
  SELECT p.id 
  FROM public.papers p
  INNER JOIN public.review_assignment_rules rar ON 1=1 -- Get the rule (assuming single rule)
  WHERE p.status = 'under-review'
  AND (
    SELECT COUNT(DISTINCT rs.id)
    FROM public.review_assignments ra
    INNER JOIN public.review_submissions rs ON ra.id = rs.assignment_id
    WHERE ra.paper_id = p.id
    AND ra.status = 'completed'
    AND rs.status = 'completed'
  ) >= rar.reviewer_count -- Only publish when we have enough completed reviews
);