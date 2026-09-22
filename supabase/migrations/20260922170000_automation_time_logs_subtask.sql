-- Vincula o log de horas trabalhadas a uma tarefa técnica específica,
-- permitindo somar o tempo por tarefa na aba Tarefas (mudança aditiva).
ALTER TABLE public.automation_time_logs
  ADD COLUMN IF NOT EXISTS subtask_id uuid REFERENCES public.automation_subtasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_automation_time_logs_subtask
  ON public.automation_time_logs(subtask_id);