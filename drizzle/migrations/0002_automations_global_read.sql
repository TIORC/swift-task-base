DROP POLICY IF EXISTS "Sector or owner read automations" ON public.automations;
CREATE POLICY "Sector or owner read automations" ON public.automations
  FOR SELECT TO authenticated
  USING (
    public.has_global_automation_access(auth.uid())
    OR has_sector_access(auth.uid(), sector)
    OR auth.uid() = created_by
    OR auth.uid() = assigned_to
    OR auth.uid() = requester_id
  );