
CREATE TABLE public.sm_task_checklist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sm_task_checklist_items TO authenticated;
GRANT ALL ON public.sm_task_checklist_items TO service_role;

ALTER TABLE public.sm_task_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Social staff read checklist"
ON public.sm_task_checklist_items FOR SELECT TO authenticated
USING (has_social_access(auth.uid()) AND NOT has_social_role(auth.uid(), 'cliente'::social_role));

CREATE POLICY "Social staff insert checklist"
ON public.sm_task_checklist_items FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by AND has_social_access(auth.uid()) AND NOT has_social_role(auth.uid(), 'cliente'::social_role));

CREATE POLICY "Social staff update checklist"
ON public.sm_task_checklist_items FOR UPDATE TO authenticated
USING (has_social_access(auth.uid()) AND NOT has_social_role(auth.uid(), 'cliente'::social_role));

CREATE POLICY "Social staff delete checklist"
ON public.sm_task_checklist_items FOR DELETE TO authenticated
USING (has_social_access(auth.uid()) AND NOT has_social_role(auth.uid(), 'cliente'::social_role));

CREATE INDEX idx_sm_task_checklist_task ON public.sm_task_checklist_items(task_id);

CREATE TRIGGER trg_sm_task_checklist_updated
BEFORE UPDATE ON public.sm_task_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
