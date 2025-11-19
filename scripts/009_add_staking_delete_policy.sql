-- Add DELETE policy for staking table
-- This allows users to delete their own staking records when unstaking completely

CREATE POLICY "staking_delete_own" ON public.staking
  FOR DELETE USING (reviewer_id = auth.uid());
