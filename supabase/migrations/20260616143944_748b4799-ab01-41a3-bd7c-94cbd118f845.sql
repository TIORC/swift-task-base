
CREATE TABLE IF NOT EXISTS public.user_sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sector text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, sector)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sectors TO authenticated;
GRANT ALL ON public.user_sectors TO service_role;

ALTER TABLE public.user_sectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own sectors" ON public.user_sectors;
CREATE POLICY "Users view own sectors" ON public.user_sectors
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

DROP POLICY IF EXISTS "Admins manage sectors" ON public.user_sectors;
CREATE POLICY "Admins manage sectors" ON public.user_sectors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS sector text;

CREATE OR REPLACE FUNCTION public.user_sector_codes(_user_id uuid)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(sector), '{}') FROM public.user_sectors WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.has_sector_access(_user_id uuid, _sector text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _sector IS NULL
    OR public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'gestor')
    OR EXISTS (SELECT 1 FROM public.user_sectors WHERE user_id = _user_id AND sector = 'TI')
    OR EXISTS (SELECT 1 FROM public.user_sectors WHERE user_id = _user_id AND sector = _sector);
$$;
