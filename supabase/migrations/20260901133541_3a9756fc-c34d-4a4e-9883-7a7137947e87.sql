
-- dependency_map_positions
DROP POLICY IF EXISTS "Auth insert map positions" ON public.dependency_map_positions;
DROP POLICY IF EXISTS "Auth update map positions" ON public.dependency_map_positions;
DROP POLICY IF EXISTS "Auth delete map positions" ON public.dependency_map_positions;

CREATE POLICY "TI can insert map positions" ON public.dependency_map_positions
FOR INSERT TO authenticated
WITH CHECK (public.has_ti_write(auth.uid()) AND updated_by = auth.uid());

CREATE POLICY "TI can update map positions" ON public.dependency_map_positions
FOR UPDATE TO authenticated
USING (public.has_ti_write(auth.uid()))
WITH CHECK (public.has_ti_write(auth.uid()) AND updated_by = auth.uid());

CREATE POLICY "TI can delete map positions" ON public.dependency_map_positions
FOR DELETE TO authenticated
USING (
  updated_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);

-- recurring_task_history
DROP POLICY IF EXISTS "System can insert recurring history" ON public.recurring_task_history;

CREATE POLICY "Users insert own recurring history" ON public.recurring_task_history
FOR INSERT TO authenticated
WITH CHECK (changed_by = auth.uid());

-- tasks (support tickets)
DROP POLICY IF EXISTS "Authenticated users can update support tickets" ON public.tasks;

CREATE POLICY "TI can update support tickets" ON public.tasks
FOR UPDATE TO authenticated
USING (title LIKE '[Chamado]%' AND public.has_ti_write(auth.uid()))
WITH CHECK (title LIKE '[Chamado]%' AND public.has_ti_write(auth.uid()));

-- task_dependencies
DROP POLICY IF EXISTS "Auth update task_dependencies" ON public.task_dependencies;

CREATE POLICY "Owners update task_dependencies" ON public.task_dependencies
FOR UPDATE TO authenticated
USING (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
)
WITH CHECK (
  auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);
