-- Add paper_chain_id column for stable numeric reference on-chain
-- Use identity for portability and clarity
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS paper_chain_id BIGINT GENERATED ALWAYS AS IDENTITY;

-- Ensure uniqueness (identity already enforces uniqueness but index helps query plans)
CREATE UNIQUE INDEX IF NOT EXISTS papers_paper_chain_id_idx ON public.papers(paper_chain_id);

-- (No backfill needed; identity auto-populates for existing rows only after
-- explicitly setting DEFAULT; perform manual backfill below if needed.)
