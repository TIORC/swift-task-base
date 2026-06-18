DROP POLICY IF EXISTS "Users can view own time logs" ON public.time_logs;
CREATE POLICY "Authenticated can view all time logs"
  ON public.time_logs FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Auth read automation_time_logs" ON public.automation_time_logs;
CREATE POLICY "Authenticated can view all automation time logs"
  ON public.automation_time_logs FOR SELECT
  TO authenticated
  USING (true);