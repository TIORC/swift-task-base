-- Menções (@pessoa) nos comentários das tarefas do Kanban.
-- Guarda os ids das pessoas citadas; o texto segue no campo content.

ALTER TABLE public.kanban_task_comments
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';
