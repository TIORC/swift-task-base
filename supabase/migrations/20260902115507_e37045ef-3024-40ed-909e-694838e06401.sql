-- Time logs for M7 tasks
CREATE TABLE public.sm_task_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.sm_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_minutes integer,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sm_task_time_logs TO authenticated;
GRANT ALL ON public.sm_task_time_logs TO service_role;
ALTER TABLE public.sm_task_time_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sm_time_select" ON public.sm_task_time_logs FOR SELECT TO authenticated
  USING (public.has_social_access(auth.uid()));
CREATE POLICY "sm_time_insert" ON public.sm_task_time_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_social_access(auth.uid()));
CREATE POLICY "sm_time_update" ON public.sm_task_time_logs FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "sm_time_delete" ON public.sm_task_time_logs FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE INDEX sm_task_time_logs_task_idx ON public.sm_task_time_logs(task_id);
CREATE TRIGGER sm_task_time_logs_updated BEFORE UPDATE ON public.sm_task_time_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comments on M7 tasks
CREATE TABLE public.sm_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.sm_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  mentions uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.sm_task_comments TO authenticated;
GRANT ALL ON public.sm_task_comments TO service_role;
ALTER TABLE public.sm_task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sm_task_comments_select" ON public.sm_task_comments FOR SELECT TO authenticated
  USING (public.has_social_access(auth.uid()));
CREATE POLICY "sm_task_comments_insert" ON public.sm_task_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.has_social_access(auth.uid()));
CREATE POLICY "sm_task_comments_delete" ON public.sm_task_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE INDEX sm_task_comments_task_idx ON public.sm_task_comments(task_id);

-- Checklist items inside workflow steps
CREATE TABLE public.sm_workflow_step_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id uuid NOT NULL REFERENCES public.sm_workflow_steps(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sm_workflow_step_items TO authenticated;
GRANT ALL ON public.sm_workflow_step_items TO service_role;
ALTER TABLE public.sm_workflow_step_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sm_wf_items_select" ON public.sm_workflow_step_items FOR SELECT TO authenticated
  USING (public.has_social_access(auth.uid()));
CREATE POLICY "sm_wf_items_insert" ON public.sm_workflow_step_items FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.has_social_access(auth.uid()));
CREATE POLICY "sm_wf_items_update" ON public.sm_workflow_step_items FOR UPDATE TO authenticated
  USING (public.has_social_access(auth.uid())) WITH CHECK (public.has_social_access(auth.uid()));
CREATE POLICY "sm_wf_items_delete" ON public.sm_workflow_step_items FOR DELETE TO authenticated
  USING (public.has_social_access(auth.uid()));
CREATE INDEX sm_workflow_step_items_step_idx ON public.sm_workflow_step_items(step_id);

-- Approval workflow on tasks
ALTER TABLE public.sm_tasks
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_status text,
  ADD COLUMN IF NOT EXISTS approval_link text,
  ADD COLUMN IF NOT EXISTS approval_notes text,
  ADD COLUMN IF NOT EXISTS approver_id uuid;

-- Account owner on clients
ALTER TABLE public.sm_clients
  ADD COLUMN IF NOT EXISTS account_owner_id uuid;