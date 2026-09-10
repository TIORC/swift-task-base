CREATE TABLE public.inventory_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_departments TO authenticated;
GRANT ALL ON public.inventory_departments TO service_role;

ALTER TABLE public.inventory_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read departments" ON public.inventory_departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ti write departments" ON public.inventory_departments
  FOR ALL TO authenticated USING (has_ti_write(auth.uid())) WITH CHECK (has_ti_write(auth.uid()));

CREATE TRIGGER update_inventory_departments_updated_at
  BEFORE UPDATE ON public.inventory_departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.inventory_departments (name)
SELECT unnest(ARRAY['DP','DF','DC','DS','Comercial','Qualidade','SC','RH','M7','BPO','TI'])
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.inventory_departments (name)
SELECT DISTINCT department FROM public.inventory_collaborators
WHERE department IS NOT NULL AND department <> ''
ON CONFLICT (name) DO NOTHING;