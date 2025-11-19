-- Update papers with completed reviews to published status
UPDATE public.papers 
SET 
  status = 'published',
  publication_date = CASE 
    WHEN publication_date IS NULL THEN NOW()
    ELSE publication_date
  END
WHERE id IN (
  SELECT DISTINCT p.id 
  FROM public.papers p
  INNER JOIN public.review_assignments ra ON p.id = ra.paper_id
  INNER JOIN public.review_submissions rs ON ra.id = rs.assignment_id
  WHERE p.status = 'under-review'
  AND ra.status = 'completed'
  AND rs.status = 'completed'
);