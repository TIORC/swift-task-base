
DROP POLICY IF EXISTS "Users can update assigned or created tasks" ON public.tasks;
CREATE POLICY "Users can update assigned or created tasks"
ON public.tasks FOR UPDATE
USING (
  auth.uid() = created_by
  OR auth.uid() = assigned_to
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (true);

DROP POLICY IF EXISTS "Creators or assigned update automations" ON public.automations;
CREATE POLICY "Creators or assigned update automations"
ON public.automations FOR UPDATE
USING (
  auth.uid() = created_by
  OR auth.uid() = assigned_to
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (true);

DROP POLICY IF EXISTS "Social staff update tasks" ON public.sm_tasks;
CREATE POLICY "Social staff update tasks"
ON public.sm_tasks FOR UPDATE
USING (
  has_social_access(auth.uid())
  AND NOT has_social_role(auth.uid(), 'cliente'::social_role)
  AND (
    auth.uid() = created_by
    OR auth.uid() = assigned_to
    OR has_social_role(auth.uid(), 'admin'::social_role)
    OR has_social_role(auth.uid(), 'gestor'::social_role)
  )
)
WITH CHECK (
  has_social_access(auth.uid())
  AND NOT has_social_role(auth.uid(), 'cliente'::social_role)
);
