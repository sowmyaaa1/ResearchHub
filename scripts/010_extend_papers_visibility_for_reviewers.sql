-- Allow reviewers (role = 'reviewer') to see submitted / under-review papers they didn't author
-- Existing policy only allows published OR author_id = auth.uid()
-- This policy expands visibility for review workflow.

CREATE POLICY "papers_select_reviewer_workflow" ON public.papers
  FOR SELECT USING (
    status IN ('submitted','under-review','under_review') AND (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'reviewer'
      )
    )
  );
