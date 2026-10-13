-- Anexos (fotos e arquivos) das tarefas do Kanban do TI.
-- Os arquivos ficam no bucket "task-attachments", em <user_id>/kanban/<task_id>/...
-- (mesmo bucket de /tarefas, então as políticas de storage já existentes valem).

CREATE TABLE public.kanban_task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  mime_type text NOT NULL,
  is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kanban_task_attachments_task_idx ON public.kanban_task_attachments(task_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_task_attachments TO authenticated;
GRANT ALL ON public.kanban_task_attachments TO service_role;
ALTER TABLE public.kanban_task_attachments ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado (igual ao quadro do Kanban).
CREATE POLICY "kta view" ON public.kanban_task_attachments FOR SELECT TO authenticated USING (true);

-- Escrita: quem pode editar a tarefa (mesma regra de kanban_tasks: criador, responsável,
-- sem responsável, admin ou líder). Gestor continua só com leitura.
CREATE POLICY "kta insert" ON public.kanban_task_attachments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.kanban_tasks t
      WHERE t.id = task_id
        AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid() OR t.assigned_to IS NULL
             OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'lider'))
    )
  );

CREATE POLICY "kta update" ON public.kanban_task_attachments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_tasks t
      WHERE t.id = task_id
        AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid() OR t.assigned_to IS NULL
             OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'lider'))
    )
  )
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "kta delete" ON public.kanban_task_attachments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
