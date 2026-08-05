DROP POLICY IF EXISTS "Sector-scoped read automations" ON public.automations;

CREATE POLICY "Sector or owner read automations"
ON public.automations
FOR SELECT
TO authenticated
USING (
  has_sector_access(auth.uid(), sector)
  OR auth.uid() = created_by
  OR auth.uid() = assigned_to
);