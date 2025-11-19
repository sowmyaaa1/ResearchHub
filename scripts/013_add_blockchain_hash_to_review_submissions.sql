-- Add blockchain_hash column to review_submissions table
ALTER TABLE public.review_submissions 
ADD COLUMN IF NOT EXISTS blockchain_hash TEXT UNIQUE;

-- Add index for blockchain_hash for performance
CREATE INDEX IF NOT EXISTS idx_review_submissions_blockchain_hash 
ON public.review_submissions(blockchain_hash);