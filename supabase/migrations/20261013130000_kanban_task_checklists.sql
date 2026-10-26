-- Checklists das tarefas do Kanban do TI.
-- Quem pode editar a tarefa (criador, responsável, sem responsável, admin ou líder)
-- pode criar, marcar e excluir itens, inclusive depois que a tarefa já foi lançada.

CREATE TABLE public.kanban_task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  content text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kanban_task_checklist_items_task_idx ON public.kanban_task_checklist_items(task_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_task_checklist_items TO authenticated;
GRANT ALL ON public.kanban_task_checklist_items TO service_role;
ALTER TABLE public.kanban_task_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ktci view" ON public.kanban_task_checklist_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "ktci insert" ON public.kanban_task_checklist_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kanban_tasks t
      WHERE t.id = task_id
        AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid() OR t.assigned_to IS NULL
             OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'lider'))
    )
  );

CREATE POLICY "ktci update" ON public.kanban_task_checklist_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_tasks t
      WHERE t.id = task_id
        AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid() OR t.assigned_to IS NULL
             OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'lider'))
    )
  )
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "ktci delete" ON public.kanban_task_checklist_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_tasks t
      WHERE t.id = task_id
        AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid() OR t.assigned_to IS NULL
             OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'lider'))
    )
  );
