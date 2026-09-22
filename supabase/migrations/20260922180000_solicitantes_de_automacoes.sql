-- ============================================================
-- Solicitantes de automação (whitelist).
-- Apenas os usuários cadastrados aqui podem ABRIR solicitações de
-- automação (insert de automação com status 'requested').
-- Mudança aditiva, sem apagar dados existentes.
-- ============================================================

-- 1) Tabela de solicitantes de automação
CREATE TABLE IF NOT EXISTS public.automation_requesters (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sector text NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_requesters_sector
  ON public.automation_requesters(sector);

ALTER TABLE public.automation_requesters ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.automation_requesters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_requesters TO service_role;

-- Leitura: cada usuário vê o próprio registro; admins veem a lista completa.
DROP POLICY IF EXISTS "Requesters read own record" ON public.automation_requesters;
CREATE POLICY "Requesters read own record"
  ON public.automation_requesters FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Gestão da lista apenas por admin.
DROP POLICY IF EXISTS "Admins manage requesters" ON public.automation_requesters;
CREATE POLICY "Admins manage requesters"
  ON public.automation_requesters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Função de verificação de solicitante
CREATE OR REPLACE FUNCTION public.is_automation_requester(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.automation_requesters WHERE user_id = _user_id)
         OR public.has_role(_user_id, 'admin')
$$;

-- 3) Cadastro dos solicitantes definidos (empresa Orcoma).
--    Setores: Contábil=DC, Fiscal=DF, Qualidade, Pessoal=RH, Societário=DS,
--             Sucesso do Cliente=SC, Comercial, M7.
DO $$
DECLARE
  _r record;
BEGIN
  FOR _r IN
    SELECT u.id AS user_id, v.sector
    FROM (VALUES
      ('geane.lopes@orcoma.com.br', 'DC'),
      ('danicarla@orcoma.com.br',   'DC'),
      ('talita.silva@orcoma.com.br','DC'),
      ('jonatas.braga@orcoma.com.br','DC'),
      ('joyce.narde@orcoma.com.br', 'DF'),
      ('saulo.assis@orcoma.com.br', 'DF'),
      ('olandson@orcoma.com.br',    'Qualidade'),
      ('kaylane.oliveira@orcoma.com.br','Qualidade'),
      ('suzane.souza@orcoma.com.br','RH'),
      ('samuel.rizzuto@orcoma.com.br','DS'),
      ('macleide@orcoma.com.br',    'SC'),
      ('gilton.novaes@orcoma.com.br','Comercial'),
      ('patrick.leite@orcoma.com.br','M7'),
      ('daniel.silva@orcoma.com.br','M7')
    ) AS v(email, sector)
    JOIN auth.users u ON u.email = v.email
  LOOP
    INSERT INTO public.automation_requesters (user_id, sector, granted_by)
    VALUES (_r.user_id, _r.sector, NULL)
    ON CONFLICT (user_id) DO UPDATE SET sector = EXCLUDED.sector;
  END LOOP;
END $$;

-- Avisa (sem falhar) se algum email de solicitante ainda não existir.
DO $$
DECLARE
  _missing text[];
BEGIN
  SELECT array_agg(v.email) INTO _missing
  FROM (VALUES
    ('geane.lopes@orcoma.com.br'),
    ('danicarla@orcoma.com.br'),
    ('talita.silva@orcoma.com.br'),
    ('jonatas.braga@orcoma.com.br'),
    ('joyce.narde@orcoma.com.br'),
    ('saulo.assis@orcoma.com.br'),
    ('olandson@orcoma.com.br'),
    ('kaylane.oliveira@orcoma.com.br'),
    ('suzane.souza@orcoma.com.br'),
    ('samuel.rizzuto@orcoma.com.br'),
    ('macleide@orcoma.com.br'),
    ('gilton.novaes@orcoma.com.br'),
    ('patrick.leite@orcoma.com.br'),
    ('daniel.silva@orcoma.com.br')
  ) AS v(email)
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = v.email);

  IF _missing IS NOT NULL THEN
    RAISE NOTICE 'Usuários solicitantes ainda não cadastrados no sistema (serão adicionados quando existirem): %', array_to_string(_missing, ', ');
  END IF;
END $$;

-- 4) Garantir que o solicitante também esteja vinculado ao seu setor,
--    para que consiga acessar a tela de automações do módulo.
INSERT INTO public.user_sectors (user_id, sector)
SELECT r.user_id, r.sector
FROM public.automation_requesters r
ON CONFLICT (user_id, sector) DO NOTHING;

-- 5) Regra de gravação: só solicitantes cadastrados podem criar uma
--    automação com status 'requested' (abrir uma solicitação).
DROP POLICY IF EXISTS "Auth create automations" ON public.automations;
CREATE POLICY "Auth create automations" ON public.automations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (status IS DISTINCT FROM 'requested' OR public.is_automation_requester(auth.uid()))
  );