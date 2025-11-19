-- Allow reviewers to insert and update their own review assignments
-- Existing policy blocks all inserts (assignments_insert_admin_only)
-- We keep admin-only policy for security but add reviewer-specific workflow.

CREATE POLICY "assignments_insert_reviewer" ON public.review_assignments
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "assignments_update_reviewer" ON public.review_assignments
  FOR UPDATE USING (reviewer_id = auth.uid());
