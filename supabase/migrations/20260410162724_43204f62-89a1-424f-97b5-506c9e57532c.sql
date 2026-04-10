
-- =============================================
-- AUTOMATIONS MODULE — FULL SCHEMA
-- =============================================

-- Main automations table
CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  objective text,
  system_process text,
  requester text,
  requester_department text,
  assigned_to uuid,
  created_by uuid NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'backlog',
  complexity text DEFAULT 'medium',
  automation_type text,
  language_tool text,
  environment text,
  needs_credentials boolean DEFAULT false,
  needs_external_integration boolean DEFAULT false,
  process_impact text,
  progress_percent integer DEFAULT 0,
  estimated_hours numeric DEFAULT 0,
  spent_hours numeric DEFAULT 0,
  estimated_deadline timestamptz,
  final_deadline timestamptz,
  started_at timestamptz,
  deployed_at timestamptz,
  completed_at timestamptz,
  risk_level text DEFAULT 'low',
  deploy_status text DEFAULT 'pending',
  documentation_done boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Subtasks / checklist
CREATE TABLE public.automation_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean DEFAULT false,
  assigned_to uuid,
  deadline timestamptz,
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Blockers / dependencies
CREATE TABLE public.automation_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  blocker_type text NOT NULL,
  description text,
  responsible_id uuid,
  pending_since timestamptz DEFAULT now(),
  resolved_at timestamptz,
  impact_on_deadline text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Timeline events
CREATE TABLE public.automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text,
  user_id uuid NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Time logs
CREATE TABLE public.automation_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_minutes integer DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Updated_at trigger for automations
CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_time_logs ENABLE ROW LEVEL SECURITY;

-- RLS for automations
CREATE POLICY "Auth read automations" ON public.automations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create automations" ON public.automations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators or assigned update automations" ON public.automations FOR UPDATE TO authenticated USING (auth.uid() = created_by OR auth.uid() = assigned_to OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Creators or admins delete automations" ON public.automations FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- RLS for subtasks
CREATE POLICY "Auth read automation_subtasks" ON public.automation_subtasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert automation_subtasks" ON public.automation_subtasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update automation_subtasks" ON public.automation_subtasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete automation_subtasks" ON public.automation_subtasks FOR DELETE TO authenticated USING (true);

-- RLS for blockers
CREATE POLICY "Auth read automation_blockers" ON public.automation_blockers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert automation_blockers" ON public.automation_blockers FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Auth update automation_blockers" ON public.automation_blockers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete automation_blockers" ON public.automation_blockers FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- RLS for events
CREATE POLICY "Auth read automation_events" ON public.automation_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert automation_events" ON public.automation_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RLS for time logs
CREATE POLICY "Auth read automation_time_logs" ON public.automation_time_logs FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Auth insert automation_time_logs" ON public.automation_time_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth update automation_time_logs" ON public.automation_time_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Auth delete automation_time_logs" ON public.automation_time_logs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.automations;
