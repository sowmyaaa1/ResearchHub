-- Add role column to profiles
ALTER TABLE IF EXISTS public.profiles ADD COLUMN role TEXT DEFAULT 'viewer';

-- Create submissions table (replacing papers for submitter workflow)
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  pdf_url TEXT NOT NULL,
  code_url TEXT,
  status TEXT DEFAULT 'draft', -- draft, submitted, under-review, reviews-complete, accepted, rejected, finalized
  submission_fee_amount DECIMAL(18, 8) DEFAULT 0,
  submission_fee_tx_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create staking table for reviewers
CREATE TABLE IF NOT EXISTS public.staking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  staked_amount DECIMAL(18, 8) NOT NULL,
  lock_until TIMESTAMP,
  slashed_amount DECIMAL(18, 8) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create wallet transactions table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tx_hash TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- fee, reward, stake, unstake, other
  amount DECIMAL(18, 8) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create review submissions table
CREATE TABLE IF NOT EXISTS public.review_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.review_assignments(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  novelty_score INT CHECK (novelty_score >= 1 AND novelty_score <= 5),
  technical_correctness_score INT CHECK (technical_correctness_score >= 1 AND technical_correctness_score <= 5),
  clarity_score INT CHECK (clarity_score >= 1 AND clarity_score <= 5),
  significance_score INT CHECK (significance_score >= 1 AND significance_score <= 5),
  recommendation TEXT, -- accept, reject
  comments TEXT,
  review_file_url TEXT,
  reward_amount DECIMAL(18, 8) DEFAULT 0,
  reward_tx_hash TEXT,
  status TEXT DEFAULT 'in-progress', -- in-progress, submitted, rewarded
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for submissions
CREATE POLICY "submissions_select_own_or_published" ON public.submissions
  FOR SELECT USING (submitter_id = auth.uid() OR status = 'finalized');

CREATE POLICY "submissions_insert_own" ON public.submissions
  FOR INSERT WITH CHECK (submitter_id = auth.uid());

CREATE POLICY "submissions_update_own" ON public.submissions
  FOR UPDATE USING (submitter_id = auth.uid());

-- RLS Policies for staking
CREATE POLICY "staking_select_own" ON public.staking
  FOR SELECT USING (reviewer_id = auth.uid());

CREATE POLICY "staking_insert_own" ON public.staking
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "staking_update_own" ON public.staking
  FOR UPDATE USING (reviewer_id = auth.uid());

-- RLS Policies for wallet transactions
CREATE POLICY "wallet_transactions_select_own" ON public.wallet_transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "wallet_transactions_insert_own" ON public.wallet_transactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for review submissions
CREATE POLICY "review_submissions_select_own_or_submitter" ON public.review_submissions
  FOR SELECT USING (reviewer_id = auth.uid() OR submission_id IN (SELECT id FROM submissions WHERE submitter_id = auth.uid()));

CREATE POLICY "review_submissions_insert_own" ON public.review_submissions
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "review_submissions_update_own" ON public.review_submissions
  FOR UPDATE USING (reviewer_id = auth.uid());

-- Create indexes
CREATE INDEX idx_submissions_submitter_id ON public.submissions(submitter_id);
CREATE INDEX idx_submissions_status ON public.submissions(status);
CREATE INDEX idx_staking_reviewer_id ON public.staking(reviewer_id);
CREATE INDEX idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);
CREATE INDEX idx_review_submissions_reviewer_id ON public.review_submissions(reviewer_id);
CREATE INDEX idx_review_submissions_submission_id ON public.review_submissions(submission_id);
