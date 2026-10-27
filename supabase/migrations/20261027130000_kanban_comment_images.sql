-- Prints/imagens nos comentários das tarefas do Kanban.
-- Os arquivos ficam no bucket "task-attachments", em <user_id>/kanban/<task_id>/comments/...
ALTER TABLE public.kanban_task_comments
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';
