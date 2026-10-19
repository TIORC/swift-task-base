-- Angel, Sofia, Gabriel e Welder podem editar e excluir livremente as tarefas recorrentes
-- (templates e instâncias geradas), independente de quem criou ou é responsável.
CREATE OR REPLACE FUNCTION public.can_manage_recurring_tasks(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _uid
      AND lower(u.email) IN (
        'angel.kauan@orcoma.com.br',
        'sofia.nardes@orcoma.com.br',
        'gabriel.anacleto@orcoma.com.br',
        'welder@orcoma.com.br'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_recurring_tasks(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_manage_recurring_tasks(uuid) TO authenticated;

DROP POLICY IF EXISTS "Recurring managers update recurring tasks" ON public.tasks;
CREATE POLICY "Recurring managers update recurring tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_recurring_tasks(auth.uid())
    AND (is_recurring_template = true OR parent_recurring_task_id IS NOT NULL)
  )
  WITH CHECK (
    public.can_manage_recurring_tasks(auth.uid())
    AND (is_recurring_template = true OR parent_recurring_task_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "Recurring managers delete recurring tasks" ON public.tasks;
CREATE POLICY "Recurring managers delete recurring tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (
    public.can_manage_recurring_tasks(auth.uid())
    AND (is_recurring_template = true OR parent_recurring_task_id IS NOT NULL)
  );
