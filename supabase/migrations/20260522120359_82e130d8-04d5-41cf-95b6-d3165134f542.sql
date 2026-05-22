-- Allow gestor to update tasks and automations (for deadline edits)
DROP POLICY IF EXISTS "Users can update assigned or created tasks" ON public.tasks;
CREATE POLICY "Users can update assigned or created tasks"
ON public.tasks FOR UPDATE
USING (
  auth.uid() = created_by
  OR auth.uid() = assigned_to
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Creators or assigned update automations" ON public.automations;
CREATE POLICY "Creators or assigned update automations"
ON public.automations FOR UPDATE
USING (
  auth.uid() = created_by
  OR auth.uid() = assigned_to
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);