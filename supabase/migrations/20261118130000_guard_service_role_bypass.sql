-- ============================================================
-- Corrige o bypass do service role no guard de campos administrativos.
--
-- Sintoma: ao informar um sistema concluído na "Modificação de Sistema" do
-- portal do solicitante, a função "solicitacoes" (service_role) devolvia 500.
-- O update de status para 'change_requested' era barrado pelo trigger com
-- "Somente a equipe de TI pode alterar campos administrativos desta automação".
--
-- Causa: o guard testava só current_setting('request.jwt.claim.role'), a
-- chave legada do PostgREST. O papel atual vem em request.jwt.claims (JSON).
-- Quando a legada vem vazia, o service_role não passava e caía na regra
-- de campos administrativos.
--
-- Esta migration mantém o mesmo corpo da 20261028150000 e só troca a leitura
-- do papel: primeiro request.jwt.claims, com fallback para a chave legada.
-- Idempotente (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_automation_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Service role (Edge Function solicitacoes) passa direto.
  IF COALESCE(
       NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
       current_setting('request.jwt.claim.role', true)
     ) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'lider'::app_role) THEN
    RETURN NEW;
  END IF;

  IF public.can_manage_automation(NEW.id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.complexity IS DISTINCT FROM OLD.complexity
     OR NEW.xp_bonus_awarded IS DISTINCT FROM OLD.xp_bonus_awarded
     OR NEW.progress_percent IS DISTINCT FROM OLD.progress_percent
     OR NEW.request_kind IS DISTINCT FROM OLD.request_kind
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

REVOKE ALL ON FUNCTION public.guard_automation_admin_fields() FROM PUBLIC, anon, authenticated;
