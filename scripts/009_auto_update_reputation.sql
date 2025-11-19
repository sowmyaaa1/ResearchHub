-- Script to automatically update user reputation when activities are completed
-- Run this to fix reputation tracking after review completion

-- Function to calculate and update user reputation
CREATE OR REPLACE FUNCTION update_user_reputation()
RETURNS TRIGGER AS $$
DECLARE
    user_id_to_update UUID;
    completed_reviews_count INTEGER;
    published_papers_count INTEGER;
    new_reputation INTEGER;
BEGIN
    -- Determine which user's reputation to update based on the trigger
    IF TG_TABLE_NAME = 'review_submissions' THEN
        user_id_to_update := NEW.reviewer_id;
    ELSIF TG_TABLE_NAME = 'papers' THEN
        user_id_to_update := NEW.author_id;
    ELSE
        RETURN NEW;
    END IF;

    -- Count completed reviews for this user
    SELECT COUNT(*) INTO completed_reviews_count
    FROM review_submissions 
    WHERE reviewer_id = user_id_to_update 
    AND status IN ('completed', 'submitted');

    -- Count published papers for this user
    SELECT COUNT(*) INTO published_papers_count
    FROM papers 
    WHERE author_id = user_id_to_update 
    AND status = 'published';

    -- Calculate new reputation: Base 100 + 50 per review + 100 per published paper
    new_reputation := 100 + (completed_reviews_count * 50) + (published_papers_count * 100);

    -- Update the user's reputation
    UPDATE profiles 
    SET reputation_score = new_reputation,
        updated_at = NOW()
    WHERE id = user_id_to_update;

    -- Log the update
    RAISE NOTICE 'Updated reputation for user %: % completed reviews, % published papers = % reputation points', 
        user_id_to_update, completed_reviews_count, published_papers_count, new_reputation;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_reputation_on_review_completion ON review_submissions;
DROP TRIGGER IF EXISTS trigger_update_reputation_on_paper_publication ON papers;

-- Create trigger for review completion
CREATE TRIGGER trigger_update_reputation_on_review_completion
    AFTER INSERT OR UPDATE ON review_submissions
    FOR EACH ROW
    WHEN (NEW.status IN ('completed', 'submitted'))
    EXECUTE FUNCTION update_user_reputation();

-- Create trigger for paper publication
CREATE TRIGGER trigger_update_reputation_on_paper_publication
    AFTER INSERT OR UPDATE ON papers
    FOR EACH ROW
    WHEN (NEW.status = 'published')
    EXECUTE FUNCTION update_user_reputation();

-- Manual reputation recalculation for all users (run once to fix existing data)
DO $$
DECLARE
    user_record RECORD;
    completed_reviews_count INTEGER;
    published_papers_count INTEGER;
    new_reputation INTEGER;
BEGIN
    FOR user_record IN SELECT id FROM profiles WHERE role IN ('reviewer', 'submitter') LOOP
        -- Count completed reviews
        SELECT COUNT(*) INTO completed_reviews_count
        FROM review_submissions 
        WHERE reviewer_id = user_record.id 
        AND status IN ('completed', 'submitted');

        -- Count published papers
        SELECT COUNT(*) INTO published_papers_count
        FROM papers 
        WHERE author_id = user_record.id 
        AND status = 'published';

        -- Calculate new reputation
        new_reputation := 100 + (completed_reviews_count * 50) + (published_papers_count * 100);

        -- Update reputation
        UPDATE profiles 
        SET reputation_score = new_reputation,
            updated_at = NOW()
        WHERE id = user_record.id;

        RAISE NOTICE 'Recalculated reputation for user %: % completed reviews, % published papers = % reputation points', 
            user_record.id, completed_reviews_count, published_papers_count, new_reputation;
    END LOOP;
END $$;

-- Verify the results
SELECT 
    p.id,
    p.full_name,
    p.role,
    p.reputation_score,
    COALESCE(rs.completed_reviews, 0) as completed_reviews,
    COALESCE(papers.published_papers, 0) as published_papers,
    (100 + COALESCE(rs.completed_reviews, 0) * 50 + COALESCE(papers.published_papers, 0) * 100) as calculated_reputation
FROM profiles p
LEFT JOIN (
    SELECT reviewer_id, COUNT(*) as completed_reviews
    FROM review_submissions 
    WHERE status IN ('completed', 'submitted')
    GROUP BY reviewer_id
) rs ON p.id = rs.reviewer_id
LEFT JOIN (
    SELECT author_id, COUNT(*) as published_papers
    FROM papers 
    WHERE status = 'published'
    GROUP BY author_id
) papers ON p.id = papers.author_id
WHERE p.role IN ('reviewer', 'submitter')
ORDER BY p.reputation_score DESC;