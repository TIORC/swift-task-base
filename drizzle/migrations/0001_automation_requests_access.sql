-- Solicitante enxerga a própria solicitação
DROP POLICY IF EXISTS "Sector or owner read automations" ON public.automations;
CREATE POLICY "Sector or owner read automations" ON public.automations
  FOR SELECT TO authenticated
  USING (
    has_sector_access(auth.uid(), sector)
    OR auth.uid() = created_by
    OR auth.uid() = assigned_to
    OR auth.uid() = requester_id
  );

-- Somente TI/gestão ou responsável administram a automação
DROP POLICY IF EXISTS "Creators or assigned update automations" ON public.automations;
CREATE POLICY "Managers requesters update automations" ON public.automations
  FOR UPDATE TO authenticated
  USING (
    public.can_manage_automation(id, auth.uid())
    OR auth.uid() = created_by
    OR auth.uid() = requester_id
  )
  WITH CHECK (
    public.can_manage_automation(id, auth.uid())
    OR auth.uid() = created_by
    OR auth.uid() = requester_id
  );

-- Guarda de campos administrativos: solicitante só edita o conteúdo da solicitação
CREATE OR REPLACE FUNCTION public.guard_automation_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF public.can_manage_automation(NEW.id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.complexity IS DISTINCT FROM OLD.complexity
     OR NEW.xp_bonus_awarded IS DISTINCT FROM OLD.xp_bonus_awarded
     OR NEW.progress_percent IS DISTINCT FROM OLD.progress_percent
     OR NEW.final_deadline IS DISTINCT FROM OLD.final_deadline
     OR NEW.estimated_deadline IS DISTINCT FROM OLD.estimated_deadline
     OR NEW.estimated_hours IS DISTINCT FROM OLD.estimated_hours
     OR NEW.risk_level IS DISTINCT FROM OLD.risk_level
     OR NEW.sector IS DISTINCT FROM OLD.sector
     OR NEW.requester_id IS DISTINCT FROM OLD.requester_id THEN
    RAISE EXCEPTION 'Somente a equipe de TI pode alterar campos administrativos desta automação';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_automation_admin_fields ON public.automations;
CREATE TRIGGER trg_guard_automation_admin_fields
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.guard_automation_admin_fields();

REVOKE ALL ON FUNCTION public.guard_automation_admin_fields() FROM PUBLIC, anon, authenticated;