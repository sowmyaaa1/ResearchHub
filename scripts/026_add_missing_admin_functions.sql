-- Migration 026: Add missing admin functions and tables
-- This script creates the missing database components for admin functionality

-- Create reviewer_status_audit table for tracking reviewer status changes
CREATE TABLE IF NOT EXISTS public.reviewer_status_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT,
  reason TEXT,
  changed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create check_author_reviewer_conflicts function
CREATE OR REPLACE FUNCTION public.check_author_reviewer_conflicts()
RETURNS TABLE(
  conflict_id UUID,
  paper_id UUID,
  paper_title TEXT,
  author_id UUID,
  author_name TEXT,
  reviewer_id UUID,
  reviewer_name TEXT,
  assignment_id UUID,
  conflict_type TEXT,
  created_at TIMESTAMP
) 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Return author-reviewer conflicts where the same person is both author and reviewer
  RETURN QUERY
  SELECT 
    gen_random_uuid() as conflict_id,
    ra.paper_id,
    COALESCE(p.title, s.title, 'Unknown Paper') as paper_title,
    COALESCE(p.author_id, s.submitter_id) as author_id,
    author_profile.full_name as author_name,
    ra.reviewer_id,
    reviewer_profile.full_name as reviewer_name,
    ra.id as assignment_id,
    'AUTHOR_REVIEWER_SAME_PERSON' as conflict_type,
    ra.created_at
  FROM public.review_assignments ra
  LEFT JOIN public.papers p ON ra.paper_id = p.id
  LEFT JOIN public.submissions s ON ra.paper_id = s.id
  LEFT JOIN public.profiles author_profile ON COALESCE(p.author_id, s.submitter_id) = author_profile.id
  LEFT JOIN public.profiles reviewer_profile ON ra.reviewer_id = reviewer_profile.id
  WHERE COALESCE(p.author_id, s.submitter_id) = ra.reviewer_id
    AND ra.status = 'pending';
END;
$$;

-- Create function to get reviewer status summary
CREATE OR REPLACE FUNCTION public.get_reviewer_status_summary()
RETURNS TABLE(
  total_reviewers BIGINT,
  active_reviewers BIGINT,
  pending_assignments BIGINT,
  completed_reviews BIGINT,
  avg_review_time_days NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM public.profiles WHERE role = 'reviewer') as total_reviewers,
    (SELECT COUNT(DISTINCT reviewer_id) FROM public.review_assignments WHERE status = 'pending') as active_reviewers,
    (SELECT COUNT(*) FROM public.review_assignments WHERE status = 'pending') as pending_assignments,
    (SELECT COUNT(*) FROM public.review_submissions WHERE status = 'submitted') as completed_reviews,
    (SELECT ROUND(AVG(EXTRACT(DAY FROM (rs.created_at - ra.assigned_at))), 2)
     FROM public.review_submissions rs 
     JOIN public.review_assignments ra ON rs.assignment_id = ra.id
     WHERE ra.assigned_at IS NOT NULL AND rs.status = 'submitted') as avg_review_time_days;
END;
$$;

-- Create function to get paper status summary
CREATE OR REPLACE FUNCTION public.get_paper_status_summary()
RETURNS TABLE(
  total_papers BIGINT,
  draft_papers BIGINT,
  under_review_papers BIGINT,
  published_papers BIGINT,
  rejected_papers BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM public.submissions) as total_papers,
    (SELECT COUNT(*) FROM public.submissions WHERE status = 'draft') as draft_papers,
    (SELECT COUNT(*) FROM public.submissions WHERE status IN ('under-review', 'submitted')) as under_review_papers,
    (SELECT COUNT(*) FROM public.submissions WHERE status = 'published') as published_papers,
    (SELECT COUNT(*) FROM public.submissions WHERE status = 'rejected') as rejected_papers;
END;
$$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_review_assignments_status ON public.review_assignments(status);
CREATE INDEX IF NOT EXISTS idx_review_assignments_reviewer_id ON public.review_assignments(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_assignments_paper_id ON public.review_assignments(paper_id);
CREATE INDEX IF NOT EXISTS idx_reviewer_status_audit_reviewer_id ON public.reviewer_status_audit(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);

-- Grant permissions
GRANT SELECT ON public.reviewer_status_audit TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_author_reviewer_conflicts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reviewer_status_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_paper_status_summary() TO authenticated;

-- Insert some test data into reviewer_status_audit
INSERT INTO public.reviewer_status_audit (reviewer_id, old_status, new_status, reason, changed_by)
SELECT 
  p.id as reviewer_id,
  'viewer' as old_status,
  'reviewer' as new_status,
  'Promoted to reviewer role' as reason,
  p.id as changed_by
FROM public.profiles p
WHERE p.role = 'reviewer'
AND NOT EXISTS (
  SELECT 1 FROM public.reviewer_status_audit rsa 
  WHERE rsa.reviewer_id = p.id
);

-- Verify the functions work
SELECT 'Functions created successfully' as status;
SELECT * FROM public.get_reviewer_status_summary();
SELECT * FROM public.get_paper_status_summary();