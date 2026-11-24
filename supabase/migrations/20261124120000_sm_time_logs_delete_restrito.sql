-- Só TI Maracas e Patrick podem excluir registros de tempo das tarefas M7.
-- Os demais usuários continuam podendo iniciar/parar o próprio cronômetro e lançar tempo manual.
DROP POLICY IF EXISTS "sm_time_delete" ON public.sm_task_time_logs;

CREATE POLICY "sm_time_delete" ON public.sm_task_time_logs FOR DELETE TO authenticated
  USING (
    lower(coalesce(auth.jwt() ->> 'email', '')) IN (
      'timaracas@orcoma.com.br',
      'patrick.leite@orcoma.com.br'
    )
  );
