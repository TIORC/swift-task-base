-- Allow assignees and admins to delete tasks (e.g. recurring tasks spawned by the system,
-- whose created_by is not the assignee).
DROP POLICY IF EXISTS "Creators can delete tasks" ON public.tasks;
CREATE POLICY "Creators, assignees or admins can delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by
    OR auth.uid() = assigned_to
    OR public.has_role(auth.uid(), 'admin')
  );
