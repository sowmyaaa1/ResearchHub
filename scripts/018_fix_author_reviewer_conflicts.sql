-- Fix security issue: Prevent authors from reviewing their own papers
-- Add database constraints and cleanup conflicting data

-- Add database constraint to prevent author-reviewer conflicts
CREATE OR REPLACE FUNCTION prevent_author_reviewer_conflict()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the reviewer is trying to review their own paper
  IF EXISTS (
    SELECT 1 FROM papers p
    WHERE p.id = NEW.paper_id 
    AND p.author_id = NEW.reviewer_id
  ) THEN
    RAISE EXCEPTION 'Cannot review own paper: Author ID % cannot be reviewer for paper %', 
      NEW.reviewer_id, NEW.paper_id;
  END IF;

  -- Check if reviewer Hedera account matches author Hedera account
  IF EXISTS (
    SELECT 1 FROM papers p
    JOIN profiles author_profile ON p.author_id = author_profile.id
    JOIN profiles reviewer_profile ON NEW.reviewer_id = reviewer_profile.id
    WHERE p.id = NEW.paper_id 
    AND author_profile.hedera_account_id = reviewer_profile.hedera_account_id
    AND author_profile.hedera_account_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot review paper: Reviewer Hedera account matches author account for paper %', 
      NEW.paper_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply constraint to reviews table
DROP TRIGGER IF EXISTS prevent_author_reviewer_conflict_trigger ON reviews;
CREATE TRIGGER prevent_author_reviewer_conflict_trigger
  BEFORE INSERT OR UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION prevent_author_reviewer_conflict();

-- Apply constraint to expertise_matching table
DROP TRIGGER IF EXISTS prevent_author_assignment_conflict_trigger ON expertise_matching;
CREATE TRIGGER prevent_author_assignment_conflict_trigger
  BEFORE INSERT OR UPDATE ON expertise_matching
  FOR EACH ROW
  EXECUTE FUNCTION prevent_author_reviewer_conflict();

-- Clean up any existing conflicting data
DELETE FROM reviews r
WHERE EXISTS (
  SELECT 1 FROM papers p
  WHERE p.id = r.paper_id 
  AND p.author_id = r.reviewer_id
);

DELETE FROM expertise_matching em
WHERE EXISTS (
  SELECT 1 FROM papers p
  WHERE p.id = em.paper_id 
  AND p.author_id = em.profile_id
);

-- Add index to improve performance of conflict checks
CREATE INDEX IF NOT EXISTS idx_papers_author_hedera_account 
ON papers(author_id) 
WHERE author_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_hedera_account 
ON profiles(hedera_account_id) 
WHERE hedera_account_id IS NOT NULL;

-- Add function to safely assign reviewer status
CREATE OR REPLACE FUNCTION set_reviewer_status(user_id UUID, is_reviewer_new BOOLEAN)
RETURNS VOID AS $$
BEGIN
  -- Update reviewer status
  UPDATE profiles 
  SET is_reviewer = is_reviewer_new,
      updated_at = NOW()
  WHERE id = user_id;

  -- If removing reviewer status, also clean up related data
  IF NOT is_reviewer_new THEN
    -- Remove any pending review assignments
    DELETE FROM expertise_matching 
    WHERE profile_id = user_id 
    AND assigned = false;

    -- Cancel any unclaimed reviews
    DELETE FROM reviews 
    WHERE reviewer_id = user_id 
    AND status = 'claimed';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add audit log for reviewer status changes
CREATE TABLE IF NOT EXISTS reviewer_status_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  old_status BOOLEAN,
  new_status BOOLEAN,
  reason TEXT,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to log reviewer status changes
CREATE OR REPLACE FUNCTION log_reviewer_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_reviewer IS DISTINCT FROM NEW.is_reviewer THEN
    INSERT INTO reviewer_status_audit (user_id, old_status, new_status, reason)
    VALUES (NEW.id, OLD.is_reviewer, NEW.is_reviewer, 'Automatic change');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for audit logging
DROP TRIGGER IF EXISTS reviewer_status_audit_trigger ON profiles;
CREATE TRIGGER reviewer_status_audit_trigger
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_reviewer_status_change();

-- Add function to check for author-reviewer conflicts
CREATE OR REPLACE FUNCTION check_author_reviewer_conflicts()
RETURNS TABLE(
  conflict_type TEXT,
  user_id UUID,
  user_name TEXT,
  hedera_account TEXT,
  paper_id UUID,
  paper_title TEXT,
  issue_description TEXT
) AS $$
BEGIN
  -- Check for users who are authors of papers and also assigned as reviewers
  RETURN QUERY
  SELECT 
    'author_is_reviewer'::TEXT as conflict_type,
    p.author_id as user_id,
    prof.full_name as user_name,
    prof.hedera_account_id as hedera_account,
    p.id as paper_id,
    p.title as paper_title,
    'Author is assigned as reviewer for their own paper'::TEXT as issue_description
  FROM papers p
  JOIN profiles prof ON p.author_id = prof.id
  JOIN expertise_matching em ON p.id = em.paper_id AND p.author_id = em.profile_id
  WHERE prof.is_reviewer = true;

  -- Check for Hedera account ID conflicts
  RETURN QUERY
  SELECT 
    'hedera_account_conflict'::TEXT as conflict_type,
    p.author_id as user_id,
    author_prof.full_name as user_name,
    author_prof.hedera_account_id as hedera_account,
    p.id as paper_id,
    p.title as paper_title,
    'Different users with same Hedera account ID assigned as author and reviewer'::TEXT as issue_description
  FROM papers p
  JOIN profiles author_prof ON p.author_id = author_prof.id
  JOIN reviews r ON p.id = r.paper_id
  JOIN profiles reviewer_prof ON r.reviewer_id = reviewer_prof.id
  WHERE author_prof.hedera_account_id = reviewer_prof.hedera_account_id
  AND author_prof.id != reviewer_prof.id
  AND author_prof.hedera_account_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Create admin view for managing reviewer conflicts
CREATE OR REPLACE VIEW admin_reviewer_conflicts AS
SELECT * FROM check_author_reviewer_conflicts();

COMMENT ON TABLE reviewer_status_audit IS 'Audit log for tracking changes to reviewer status';
COMMENT ON FUNCTION prevent_author_reviewer_conflict() IS 'Prevents authors from reviewing their own papers at database level';
COMMENT ON FUNCTION check_author_reviewer_conflicts() IS 'Identifies existing author-reviewer conflicts for admin review';
COMMENT ON VIEW admin_reviewer_conflicts IS 'Admin view showing all detected author-reviewer conflicts';