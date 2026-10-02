-- Separa "Sistema" de "Automação" em toda solicitação.
--
-- A escolha já era feita pelo solicitante na tela inicial de /solicitacoes
-- (os cartões SISTEMAS / AUTOMAÇÃO DE PROCESSOS), mas o RequestAutomationDialog
-- recebia esse valor e não gravava em lugar nenhum — as duas modalidades
-- acabavam misturadas na mesma lista. Este campo guarda a resposta.
--
--automation_type NÃO serve aqui: ele guarda a ferramenta ("RPA", "Script").

ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS request_kind TEXT;

DO $$ BEGIN
  ALTER TABLE public.automations
    ADD CONSTRAINT automations_request_kind_check
    CHECK (request_kind IS NULL OR request_kind IN ('Sistema', 'Automação'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Registros antigos não têm como ser retroclassificados com segurança: a
-- description é um texto corrido montado pelo formulário, sem marcador de tipo.
-- Ficam com request_kind NULL e a equipe de TI classifica pela aba Dados.

-- Classificação é campo administrativo: só a equipe de TI define/ajusta.
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
