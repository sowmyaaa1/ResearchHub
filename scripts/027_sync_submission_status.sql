-- Migration to sync submission status with published papers
-- This ensures published papers don't appear as available for review

-- Update submissions status to match published papers
UPDATE public.submissions 
SET status = 'published', updated_at = NOW()
WHERE id IN (
  SELECT s.id 
  FROM public.submissions s
  INNER JOIN public.papers p ON s.id = p.id
  WHERE p.status = 'published' 
    AND s.status IN ('under-review', 'submitted')
);

-- Add a trigger to keep submissions and papers status in sync
CREATE OR REPLACE FUNCTION sync_submission_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When a paper status changes, update the corresponding submission
  IF NEW.status != OLD.status THEN
    UPDATE public.submissions 
    SET status = CASE 
      WHEN NEW.status = 'published' THEN 'published'
      WHEN NEW.status = 'rejected' THEN 'rejected'
      WHEN NEW.status = 'under_review' THEN 'under-review'
      ELSE NEW.status
    END,
    updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync status changes
DROP TRIGGER IF EXISTS sync_paper_submission_status ON public.papers;
CREATE TRIGGER sync_paper_submission_status
  AFTER UPDATE ON public.papers
  FOR EACH ROW
  EXECUTE FUNCTION sync_submission_status();