
CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_field TEXT NOT NULL CHECK (trigger_field IN ('status', 'priority', 'assigned_to')),
  trigger_value TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('change_status', 'notify_assigned', 'notify_creator', 'assign_to')),
  action_value TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read automation_rules" ON public.automation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert automation_rules" ON public.automation_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators update automation_rules" ON public.automation_rules FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Creators delete automation_rules" ON public.automation_rules FOR DELETE TO authenticated USING (auth.uid() = created_by);
