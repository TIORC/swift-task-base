
-- Fix subtask RLS: restrict to automation owner/assigned/admin
DROP POLICY "Auth insert automation_subtasks" ON public.automation_subtasks;
DROP POLICY "Auth update automation_subtasks" ON public.automation_subtasks;
DROP POLICY "Auth delete automation_subtasks" ON public.automation_subtasks;

CREATE POLICY "Members insert automation_subtasks" ON public.automation_subtasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_id AND (a.created_by = auth.uid() OR a.assigned_to = auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Members update automation_subtasks" ON public.automation_subtasks FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_id AND (a.created_by = auth.uid() OR a.assigned_to = auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Members delete automation_subtasks" ON public.automation_subtasks FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_id AND (a.created_by = auth.uid() OR a.assigned_to = auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );

-- Fix blocker update RLS
DROP POLICY "Auth update automation_blockers" ON public.automation_blockers;
CREATE POLICY "Members update automation_blockers" ON public.automation_blockers FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_id AND (a.created_by = auth.uid() OR a.assigned_to = auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );
