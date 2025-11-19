-- Migration 017: Decentralized Research Hub Schema Updates
-- This migration transforms the system to fully decentralized architecture

-- Add new columns to profiles for decentralized identity
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hedera_account_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS encrypted_key_blob TEXT; -- Client-side encrypted private key
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expertise_tags TEXT[] DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS on_chain_reputation INTEGER DEFAULT 100;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_activity_timestamp TIMESTAMP DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_reviewer BOOLEAN DEFAULT false;

-- Remove private_key column if it exists (security requirement)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS private_key;

-- Update papers table for IPFS and HCS integration
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS ipfs_cid TEXT; -- IPFS hash for paper content
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS hcs_sequence_number BIGINT; -- Hedera Consensus Service sequence
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS hedera_tx_id TEXT; -- Hedera transaction ID for paper submission
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS submitter_account TEXT; -- Hedera account ID of submitter
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS submission_fee_hbar DECIMAL(18, 8); -- Submission fee in HBAR
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS reward_pool_hbar DECIMAL(18, 8); -- Reward pool for reviewers
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS required_reviews INTEGER DEFAULT 3; -- Number of reviews needed
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS consensus_reached BOOLEAN DEFAULT false;
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS consensus_verdict BOOLEAN; -- true = accepted, false = rejected

-- Update reviews table for IPFS and on-chain integration
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS ipfs_cid TEXT; -- IPFS hash for review content
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_account TEXT; -- Hedera account ID
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS stake_amount_hbar DECIMAL(18, 8); -- Stake amount in HBAR
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS stake_tx_id TEXT; -- Staking transaction ID
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS submit_tx_id TEXT; -- Review submission transaction ID
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS verdict INTEGER; -- 1=accept, 2=minor revision, 3=major revision, 4=reject
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS aligned_with_consensus BOOLEAN;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reward_amount_hbar DECIMAL(18, 8);
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS slashed_amount_hbar DECIMAL(18, 8);

-- Create new reputation_cache table
CREATE TABLE IF NOT EXISTS public.reputation_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hedera_account_id TEXT NOT NULL UNIQUE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    on_chain_reputation INTEGER NOT NULL DEFAULT 100,
    total_reviews_completed INTEGER DEFAULT 0,
    successful_reviews INTEGER DEFAULT 0,
    total_stake_amount DECIMAL(18, 8) DEFAULT 0,
    total_rewards_earned DECIMAL(18, 8) DEFAULT 0,
    total_slashed_amount DECIMAL(18, 8) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create wallet_cache table for on-chain balance tracking
CREATE TABLE IF NOT EXISTS public.wallet_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hedera_account_id TEXT NOT NULL UNIQUE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    hbar_balance DECIMAL(18, 8) DEFAULT 0,
    paper_token_balance DECIMAL(18, 8) DEFAULT 0,
    staked_amount DECIMAL(18, 8) DEFAULT 0,
    available_balance DECIMAL(18, 8) DEFAULT 0,
    last_sync TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create hedera_tx_records table for transaction tracking
CREATE TABLE IF NOT EXISTS public.hedera_tx_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT NOT NULL UNIQUE,
    transaction_type TEXT NOT NULL, -- 'paper_submission', 'review_claim', 'review_submit', 'reward_distribution', 'stake', 'unstake'
    hedera_account_id TEXT NOT NULL,
    paper_id UUID REFERENCES public.papers(id) ON DELETE SET NULL,
    review_id UUID REFERENCES public.reviews(id) ON DELETE SET NULL,
    amount_hbar DECIMAL(18, 8),
    status TEXT DEFAULT 'pending', -- 'pending', 'success', 'failed'
    block_timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create hcs_messages table for Hedera Consensus Service tracking
CREATE TABLE IF NOT EXISTS public.hcs_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id TEXT NOT NULL,
    sequence_number BIGINT NOT NULL,
    consensus_timestamp TIMESTAMP NOT NULL,
    message_type TEXT NOT NULL, -- 'paper_submission', 'review_submission', 'consensus_reached'
    message_data JSONB NOT NULL,
    paper_id UUID REFERENCES public.papers(id) ON DELETE SET NULL,
    review_id UUID REFERENCES public.reviews(id) ON DELETE SET NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(topic_id, sequence_number)
);

-- Create expertise_matching table for reviewer assignment
CREATE TABLE IF NOT EXISTS public.expertise_matching (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
    reviewer_account TEXT NOT NULL,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    expertise_score DECIMAL(5, 2), -- 0-100 matching score
    reputation_score INTEGER,
    available_stake DECIMAL(18, 8),
    assignment_priority INTEGER,
    assigned BOOLEAN DEFAULT false,
    assigned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create smart_contract_events table for indexing on-chain events
CREATE TABLE IF NOT EXISTS public.smart_contract_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_address TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_data JSONB NOT NULL,
    transaction_id TEXT NOT NULL,
    block_timestamp TIMESTAMP NOT NULL,
    processed BOOLEAN DEFAULT false,
    paper_id UUID REFERENCES public.papers(id) ON DELETE SET NULL,
    review_id UUID REFERENCES public.reviews(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_hedera_account ON public.profiles(hedera_account_id);
CREATE INDEX IF NOT EXISTS idx_profiles_expertise ON public.profiles USING GIN(expertise_tags);
CREATE INDEX IF NOT EXISTS idx_papers_ipfs_cid ON public.papers(ipfs_cid);
CREATE INDEX IF NOT EXISTS idx_papers_hcs_sequence ON public.papers(hcs_sequence_number);
CREATE INDEX IF NOT EXISTS idx_papers_hedera_tx ON public.papers(hedera_tx_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_account ON public.reviews(reviewer_account);
CREATE INDEX IF NOT EXISTS idx_reviews_stake_tx ON public.reviews(stake_tx_id);
CREATE INDEX IF NOT EXISTS idx_reputation_cache_account ON public.reputation_cache(hedera_account_id);
CREATE INDEX IF NOT EXISTS idx_wallet_cache_account ON public.wallet_cache(hedera_account_id);
CREATE INDEX IF NOT EXISTS idx_tx_records_transaction_id ON public.hedera_tx_records(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_records_account ON public.hedera_tx_records(hedera_account_id);
CREATE INDEX IF NOT EXISTS idx_hcs_messages_topic ON public.hcs_messages(topic_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_hcs_messages_paper ON public.hcs_messages(paper_id);
CREATE INDEX IF NOT EXISTS idx_expertise_matching_paper ON public.expertise_matching(paper_id);
CREATE INDEX IF NOT EXISTS idx_expertise_matching_reviewer ON public.expertise_matching(reviewer_account);
CREATE INDEX IF NOT EXISTS idx_contract_events_contract ON public.smart_contract_events(contract_address);
CREATE INDEX IF NOT EXISTS idx_contract_events_timestamp ON public.smart_contract_events(block_timestamp);

-- Enable RLS for new tables
ALTER TABLE public.reputation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hedera_tx_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hcs_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expertise_matching ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_contract_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reputation_cache
CREATE POLICY "reputation_select_own_or_public" ON public.reputation_cache
  FOR SELECT USING (profile_id = auth.uid() OR TRUE);

-- RLS Policies for wallet_cache
CREATE POLICY "wallet_cache_select_own" ON public.wallet_cache
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "wallet_cache_update_own" ON public.wallet_cache
  FOR UPDATE USING (profile_id = auth.uid());

-- RLS Policies for hedera_tx_records
CREATE POLICY "tx_records_select_own_or_public" ON public.hedera_tx_records
  FOR SELECT USING (
    hedera_account_id = (
      SELECT p.hedera_account_id 
      FROM public.profiles p 
      WHERE p.id = auth.uid()
    ) OR TRUE
  );

-- RLS Policies for hcs_messages (public read access)
CREATE POLICY "hcs_messages_select_all" ON public.hcs_messages
  FOR SELECT USING (TRUE);

-- RLS Policies for expertise_matching
CREATE POLICY "expertise_matching_select_involved" ON public.expertise_matching
  FOR SELECT USING (
    profile_id = auth.uid() OR 
    paper_id IN (SELECT id FROM public.papers WHERE author_id = auth.uid())
  );

-- RLS Policies for smart_contract_events (public read access for transparency)
CREATE POLICY "contract_events_select_all" ON public.smart_contract_events
  FOR SELECT USING (TRUE);

-- Add constraints
ALTER TABLE public.profiles ADD CONSTRAINT unique_hedera_account UNIQUE(hedera_account_id);
ALTER TABLE public.papers ADD CONSTRAINT unique_ipfs_cid UNIQUE(ipfs_cid);
ALTER TABLE public.reviews ADD CONSTRAINT valid_verdict CHECK (verdict >= 1 AND verdict <= 4);

-- Update existing data where possible
UPDATE public.profiles 
SET is_reviewer = true 
WHERE role = 'reviewer';

-- Create trigger function for automatic cache updates
CREATE OR REPLACE FUNCTION update_reputation_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- Update reputation cache when reviews are completed
  IF TG_OP = 'UPDATE' AND NEW.aligned_with_consensus IS NOT NULL THEN
    INSERT INTO public.reputation_cache (
      hedera_account_id,
      profile_id,
      on_chain_reputation,
      total_reviews_completed,
      successful_reviews,
      total_rewards_earned,
      total_slashed_amount
    )
    SELECT 
      NEW.reviewer_account,
      NEW.reviewer_id,
      COALESCE(p.on_chain_reputation, 100),
      1,
      CASE WHEN NEW.aligned_with_consensus THEN 1 ELSE 0 END,
      COALESCE(NEW.reward_amount_hbar, 0),
      COALESCE(NEW.slashed_amount_hbar, 0)
    FROM public.profiles p
    WHERE p.id = NEW.reviewer_id
    ON CONFLICT (hedera_account_id) DO UPDATE SET
      total_reviews_completed = reputation_cache.total_reviews_completed + 1,
      successful_reviews = reputation_cache.successful_reviews + 
        (CASE WHEN NEW.aligned_with_consensus THEN 1 ELSE 0 END),
      total_rewards_earned = reputation_cache.total_rewards_earned + 
        COALESCE(NEW.reward_amount_hbar, 0),
      total_slashed_amount = reputation_cache.total_slashed_amount + 
        COALESCE(NEW.slashed_amount_hbar, 0),
      last_updated = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_reputation_cache_trigger ON public.reviews;
CREATE TRIGGER update_reputation_cache_trigger
  AFTER UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_reputation_cache();

COMMENT ON TABLE public.reputation_cache IS 'Cached on-chain reputation data from smart contracts';
COMMENT ON TABLE public.wallet_cache IS 'Cached wallet balances and staking information';
COMMENT ON TABLE public.hedera_tx_records IS 'Record of all Hedera transactions for audit trail';
COMMENT ON TABLE public.hcs_messages IS 'Messages from Hedera Consensus Service topic';
COMMENT ON TABLE public.expertise_matching IS 'Reviewer assignment scoring based on expertise and reputation';
COMMENT ON TABLE public.smart_contract_events IS 'Indexed smart contract events from Hedera network';