-- Make submission_id nullable in review_submissions table
-- This allows reviews to be submitted for papers that don't have submission records
ALTER TABLE public.review_submissions 
ALTER COLUMN submission_id DROP NOT NULL;