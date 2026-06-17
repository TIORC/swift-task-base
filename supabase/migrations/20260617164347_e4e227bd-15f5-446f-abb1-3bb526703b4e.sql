CREATE OR REPLACE FUNCTION public.has_sector_access(_user_id uuid, _sector text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR public.has_role(_user_id, 'gestor')
    OR (
      _sector IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_sectors us
        WHERE us.user_id = _user_id
          AND us.sector = _sector
      )
    )
    OR (
      _sector = 'TI'
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_sectors us
        WHERE us.user_id = _user_id
      )
    );
$$;

DROP POLICY IF EXISTS "Sector-scoped read automations" ON public.automations;

CREATE POLICY "Sector-scoped read automations"
ON public.automations
FOR SELECT
TO authenticated
USING (public.has_sector_access(auth.uid(), sector));