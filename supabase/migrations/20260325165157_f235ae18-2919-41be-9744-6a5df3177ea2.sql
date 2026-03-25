
-- Fix overly permissive UPDATE policy on tasks
DROP POLICY "Users can update tasks" ON public.tasks;
CREATE POLICY "Users can update assigned or created tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = created_by OR auth.uid() = assigned_to);
