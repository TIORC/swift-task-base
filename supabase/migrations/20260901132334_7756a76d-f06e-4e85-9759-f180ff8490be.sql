-- sm_tasks extras
ALTER TABLE public.sm_tasks
  ADD COLUMN IF NOT EXISTS nature text NOT NULL DEFAULT 'avulsa',
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS billable text,
  ADD COLUMN IF NOT EXISTS discard_reason text,
  ADD COLUMN IF NOT EXISTS workflow_id uuid,
  ADD COLUMN IF NOT EXISTS workflow_step_id uuid,
  ADD COLUMN IF NOT EXISTS is_approval_step boolean NOT NULL DEFAULT false;

UPDATE public.sm_tasks
SET nature = 'recorrente'
WHERE (is_recurring_template = true OR parent_recurring_task_id IS NOT NULL) AND nature = 'avulsa';

-- sm_clients: plano contratado
ALTER TABLE public.sm_clients
  ADD COLUMN IF NOT EXISTS plan_posts_per_month integer,
  ADD COLUMN IF NOT EXISTS plan_formats text,
  ADD COLUMN IF NOT EXISTS plan_notes text,
  ADD COLUMN IF NOT EXISTS onboarding_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

-- Fluxos de demanda
CREATE TABLE IF NOT EXISTS public.sm_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  service text,
  is_default_operation boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sm_workflows TO authenticated;
GRANT ALL ON public.sm_workflows TO service_role;
ALTER TABLE public.sm_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social users read workflows" ON public.sm_workflows
  FOR SELECT TO authenticated USING (public.has_social_access(auth.uid()));
CREATE POLICY "social users create workflows" ON public.sm_workflows
  FOR INSERT TO authenticated WITH CHECK (public.has_social_access(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "social users update workflows" ON public.sm_workflows
  FOR UPDATE TO authenticated USING (public.has_social_access(auth.uid()));
CREATE POLICY "owners delete workflows" ON public.sm_workflows
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_sm_workflows_upd BEFORE UPDATE ON public.sm_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.sm_workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.sm_workflows(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  days_offset integer NOT NULL DEFAULT 0,
  assigned_to uuid,
  is_approval boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sm_workflow_steps TO authenticated;
GRANT ALL ON public.sm_workflow_steps TO service_role;
ALTER TABLE public.sm_workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social users read workflow steps" ON public.sm_workflow_steps
  FOR SELECT TO authenticated USING (public.has_social_access(auth.uid()));
CREATE POLICY "social users create workflow steps" ON public.sm_workflow_steps
  FOR INSERT TO authenticated WITH CHECK (public.has_social_access(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "social users update workflow steps" ON public.sm_workflow_steps
  FOR UPDATE TO authenticated USING (public.has_social_access(auth.uid()));
CREATE POLICY "owners delete workflow steps" ON public.sm_workflow_steps
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_sm_workflow_steps_upd BEFORE UPDATE ON public.sm_workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SLA por prioridade
CREATE TABLE IF NOT EXISTS public.sm_sla_config (
  priority text PRIMARY KEY,
  hours integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sm_sla_config TO authenticated;
GRANT ALL ON public.sm_sla_config TO service_role;
ALTER TABLE public.sm_sla_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social users read sla" ON public.sm_sla_config
  FOR SELECT TO authenticated USING (public.has_social_access(auth.uid()));
CREATE POLICY "social users write sla" ON public.sm_sla_config
  FOR INSERT TO authenticated WITH CHECK (public.has_social_access(auth.uid()));
CREATE POLICY "social users update sla" ON public.sm_sla_config
  FOR UPDATE TO authenticated USING (public.has_social_access(auth.uid()));

INSERT INTO public.sm_sla_config (priority, hours) VALUES
  ('urgent', 4), ('high', 24), ('medium', 72), ('low', 168)
ON CONFLICT (priority) DO NOTHING;

CREATE TRIGGER trg_sm_sla_config_upd BEFORE UPDATE ON public.sm_sla_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();