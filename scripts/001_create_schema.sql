-- Create profiles table for user management
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  institution TEXT,
  bio TEXT,
  avatar_url TEXT,
  wallet_address TEXT UNIQUE,
  reputation_score INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create papers table
CREATE TABLE IF NOT EXISTS public.papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  content_url TEXT,
  pdf_url TEXT,
  keywords TEXT[],
  status TEXT DEFAULT 'draft', -- draft, submitted, under_review, published, rejected
  submission_date TIMESTAMP DEFAULT NOW(),
  publication_date TIMESTAMP,
  view_count INT DEFAULT 0,
  citation_count INT DEFAULT 0,
  blockchain_hash TEXT UNIQUE, -- Hedera transaction hash for verification
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INT CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  recommendation TEXT, -- accept, minor_revision, major_revision, reject
  blockchain_hash TEXT UNIQUE, -- Hedera transaction hash for verification
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create review assignments table
CREATE TABLE IF NOT EXISTS public.review_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, accepted, declined, completed
  due_date TIMESTAMP,
  assigned_at TIMESTAMP DEFAULT NOW()
);

-- Create blockchain verification table
CREATE TABLE IF NOT EXISTS public.blockchain_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID,
  entity_type TEXT, -- paper, review
  transaction_hash TEXT UNIQUE NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "profiles_select_own_or_public" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR TRUE);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for papers
CREATE POLICY "papers_select_all" ON public.papers
  FOR SELECT USING (status = 'published' OR author_id = auth.uid());

CREATE POLICY "papers_insert_own" ON public.papers
  FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE POLICY "papers_update_own" ON public.papers
  FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "papers_delete_own" ON public.papers
  FOR DELETE USING (author_id = auth.uid());

-- RLS Policies for reviews
CREATE POLICY "reviews_select_own_or_author" ON public.reviews
  FOR SELECT USING (reviewer_id = auth.uid() OR (paper_id IN (SELECT id FROM papers WHERE author_id = auth.uid())));

CREATE POLICY "reviews_insert_own" ON public.reviews
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "reviews_update_own" ON public.reviews
  FOR UPDATE USING (reviewer_id = auth.uid());

-- RLS Policies for review_assignments
CREATE POLICY "assignments_select_own_or_author" ON public.review_assignments
  FOR SELECT USING (reviewer_id = auth.uid() OR (paper_id IN (SELECT id FROM papers WHERE author_id = auth.uid())));

CREATE POLICY "assignments_insert_admin_only" ON public.review_assignments
  FOR INSERT WITH CHECK (FALSE); -- Only admins can insert via RPC

-- RLS Policies for blockchain_verifications
CREATE POLICY "blockchain_verifications_select_all" ON public.blockchain_verifications
  FOR SELECT USING (TRUE);

-- Create trigger for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for performance
CREATE INDEX idx_papers_author_id ON public.papers(author_id);
CREATE INDEX idx_papers_status ON public.papers(status);
CREATE INDEX idx_reviews_paper_id ON public.reviews(paper_id);
CREATE INDEX idx_reviews_reviewer_id ON public.reviews(reviewer_id);
CREATE INDEX idx_assignments_paper_id ON public.review_assignments(paper_id);
CREATE INDEX idx_assignments_reviewer_id ON public.review_assignments(reviewer_id);
