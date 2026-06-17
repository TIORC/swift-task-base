
-- Backfill nulls so we can enforce NOT NULL
UPDATE public.automations SET sector = 'TI' WHERE sector IS NULL;

-- Enforce sector mandatory
ALTER TABLE public.automations ALTER COLUMN sector SET NOT NULL;

-- Replace read policy with sector-aware visibility
DROP POLICY IF EXISTS "Auth read automations" ON public.automations;

CREATE POLICY "Sector-scoped read automations"
ON public.automations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gestor')
  OR EXISTS (
    SELECT 1 FROM public.user_sectors us
    WHERE us.user_id = auth.uid()
      AND us.sector = public.automations.sector
  )
);
