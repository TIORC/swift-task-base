-- Prints/imagens nos comentários das automações (chat do desenvolvedor).
-- Os arquivos ficam no bucket "task-attachments", em <user_id>/automations/<automation_id>/comments/...
-- Mesmo padrão já usado nos comentários do Kanban (kanban_task_comments.images).
ALTER TABLE public.automation_comments
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';
