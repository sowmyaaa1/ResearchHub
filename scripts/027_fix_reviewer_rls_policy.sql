-- Fix RLS policy for submissions table to allow reviewers to see papers for review
-- This replaces the overly restrictive policy that only allowed viewing your own or finalized papers

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "submissions_select_own_or_published" ON public.submissions;

-- Create new policy that allows:
-- 1. Authors to see their own submissions (any status)
-- 2. Reviewers to see papers available for review (submitted/under-review status) 
-- 3. Everyone to see finalized papers
CREATE POLICY "submissions_select_policy" ON public.submissions
    FOR SELECT USING (
        -- Authors can see their own submissions
        submitter_id = auth.uid() 
        OR 
        -- Reviewers can see papers available for review
        (status IN ('submitted', 'under-review') AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'reviewer'
        ))
        OR
        -- Everyone can see finalized papers
        status = 'finalized'
        OR
        -- Admins can see everything
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );