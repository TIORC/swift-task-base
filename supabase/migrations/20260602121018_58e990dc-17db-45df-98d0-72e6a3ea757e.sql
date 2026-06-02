-- Modelos de tarefa para Social Media
CREATE TABLE public.sm_task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority sm_priority NOT NULL DEFAULT 'medium',
  client_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sm_task_templates TO authenticated;
GRANT ALL ON public.sm_task_templates TO service_role;

ALTER TABLE public.sm_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Social staff read templates" ON public.sm_task_templates FOR SELECT TO authenticated
  USING (has_social_access(auth.uid()) AND NOT has_social_role(auth.uid(), 'cliente'::social_role));
CREATE POLICY "Social staff insert templates" ON public.sm_task_templates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND has_social_access(auth.uid()) AND NOT has_social_role(auth.uid(), 'cliente'::social_role));
CREATE POLICY "Social staff update templates" ON public.sm_task_templates FOR UPDATE TO authenticated
  USING (has_social_access(auth.uid()) AND NOT has_social_role(auth.uid(), 'cliente'::social_role));
CREATE POLICY "Creators delete templates" ON public.sm_task_templates FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_social_role(auth.uid(), 'admin'::social_role));

CREATE TRIGGER trg_sm_task_templates_updated_at BEFORE UPDATE ON public.sm_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Itens de checklist do modelo
CREATE TABLE public.sm_task_template_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.sm_task_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sm_task_template_items TO authenticated;
GRANT ALL ON public.sm_task_template_items TO service_role;

ALTER TABLE public.sm_task_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Social staff read template items" ON public.sm_task_template_items FOR SELECT TO authenticated
  USING (has_social_access(auth.uid()) AND NOT has_social_role(auth.uid(), 'cliente'::social_role));
CREATE POLICY "Social staff insert template items" ON public.sm_task_template_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND has_social_access(auth.uid()) AND NOT has_social_role(auth.uid(), 'cliente'::social_role));
CREATE POLICY "Social staff update template items" ON public.sm_task_template_items FOR UPDATE TO authenticated
  USING (has_social_access(auth.uid()) AND NOT has_social_role(auth.uid(), 'cliente'::social_role));
CREATE POLICY "Social staff delete template items" ON public.sm_task_template_items FOR DELETE TO authenticated
  USING (has_social_access(auth.uid()) AND NOT has_social_role(auth.uid(), 'cliente'::social_role));

CREATE INDEX idx_sm_task_template_items_template ON public.sm_task_template_items(template_id);