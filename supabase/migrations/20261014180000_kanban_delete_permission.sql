-- Quem pode excluir tarefas do Kanban: o criador da tarefa e os corporativos abaixo.
-- Mesma lista de nomes usada no front (canDeleteKanbanTaskName, em useKanbanTasks.ts).
CREATE OR REPLACE FUNCTION public.kanban_can_delete(_task_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kanban_tasks t
    WHERE t.id = _task_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (
              lower(trim(p.full_name)) IN ('gabriel anacleto', 'sofia nardes', 'angel kauan', 'welder')
              OR lower(trim(p.full_name)) LIKE 'welder %'
            )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.kanban_can_delete(uuid) TO authenticated;

DROP POLICY IF EXISTS "kanban delete" ON public.kanban_tasks;
CREATE POLICY "kanban delete" ON public.kanban_tasks FOR DELETE TO authenticated
  USING (public.kanban_can_delete(id));
