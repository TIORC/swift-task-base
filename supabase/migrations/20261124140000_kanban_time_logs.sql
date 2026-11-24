-- ============================================================================
-- Cronômetro das tarefas do Kanban (mesmo modelo dos logs de automações).
-- Cada usuário só cria e altera o próprio registro; a equipe consegue ler
-- para montar os relatórios de tempo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kanban_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_minutes double precision NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_time_logs TO authenticated;
GRANT ALL ON public.kanban_time_logs TO service_role;

ALTER TABLE public.kanban_time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_time_logs_select" ON public.kanban_time_logs;
CREATE POLICY "kanban_time_logs_select" ON public.kanban_time_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kanban_time_logs_insert" ON public.kanban_time_logs;
CREATE POLICY "kanban_time_logs_insert" ON public.kanban_time_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "kanban_time_logs_update" ON public.kanban_time_logs;
CREATE POLICY "kanban_time_logs_update" ON public.kanban_time_logs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "kanban_time_logs_delete" ON public.kanban_time_logs;
CREATE POLICY "kanban_time_logs_delete" ON public.kanban_time_logs
  FOR DELETE TO authenticated USING (user_id = auth.uid());
