DROP POLICY "kanban update" ON public.kanban_tasks;
CREATE POLICY "kanban update" ON public.kanban_tasks FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to OR assigned_to IS NULL OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'lider'))
  WITH CHECK (auth.uid() IS NOT NULL);