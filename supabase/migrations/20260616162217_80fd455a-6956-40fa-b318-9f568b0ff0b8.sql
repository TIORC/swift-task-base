
CREATE TABLE public.automation_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  depends_on_automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  relation_type text NOT NULL DEFAULT 'depends_on',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (automation_id, depends_on_automation_id),
  CHECK (automation_id <> depends_on_automation_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_dependencies TO authenticated;
GRANT ALL ON public.automation_dependencies TO service_role;

ALTER TABLE public.automation_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view automation dependencies"
ON public.automation_dependencies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create automation dependencies"
ON public.automation_dependencies FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can delete automation dependencies"
ON public.automation_dependencies FOR DELETE TO authenticated USING (true);
