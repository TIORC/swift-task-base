-- ============================================================
-- Libera a equipe de TI em /k7f3q9x2/solicitacoes.
--   Desenvolvedores : welder@, gabriel.anacleto@
--   Suportes/Infra  : angel.kauan@, sofia.narde@
-- Todos entram como Solicitantes (acesso livre à tela) e recebem
-- a saudação correspondente ao seu papel no app.
-- Mudança aditiva, sem apagar dados existentes.
-- ============================================================

DO $$
DECLARE
  _r record;
BEGIN
  FOR _r IN
    SELECT u.id AS user_id, v.role, v.sector
    FROM (VALUES
      ('welder@orcoma.com.br',            'dev'::app_role,     'TI'),
      ('gabriel.anacleto@orcoma.com.br',  'dev'::app_role,     'TI'),
      ('angel.kauan@orcoma.com.br',       'suporte'::app_role, 'TI'),
      ('sofia.narde@orcoma.com.br',       'suporte'::app_role, 'TI')
    ) AS v(email, role, sector)
    JOIN auth.users u ON u.email = v.email
  LOOP
    -- 1) Papel do usuário (idempotente: só acrescenta o que falta)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_r.user_id, _r.role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- 2) Acesso ao sistema TI (necessário para abrir a tela de Solicitações)
    INSERT INTO public.user_systems (user_id, system, enabled)
    VALUES (_r.user_id, 'ti', true)
    ON CONFLICT (user_id, system) DO UPDATE SET enabled = true;

    -- 3) Vínculo com o setor TI
    INSERT INTO public.user_sectors (user_id, sector)
    VALUES (_r.user_id, _r.sector)
    ON CONFLICT (user_id, sector) DO NOTHING;

    -- 4) Acesso livre às Solicitações: entram na whitelist de solicitantes,
    --    liberando o gate da tela e a policy de insert em automations.
    INSERT INTO public.automation_requesters (user_id, sector, granted_by)
    VALUES (_r.user_id, _r.sector, NULL)
    ON CONFLICT (user_id) DO UPDATE SET sector = EXCLUDED.sector;
  END LOOP;
END $$;

-- Avisa (sem falhar) se algum e-mail ainda não existir no Auth.
DO $$
DECLARE
  _missing text[];
BEGIN
  SELECT array_agg(v.email) INTO _missing
  FROM (VALUES
    ('welder@orcoma.com.br'),
    ('gabriel.anacleto@orcoma.com.br'),
    ('angel.kauan@orcoma.com.br'),
    ('sofia.narde@orcoma.com.br')
  ) AS v(email)
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = v.email);

  IF _missing IS NOT NULL THEN
    RAISE NOTICE 'Usuários de TI ainda não cadastrados no Auth (serão liberados quando existirem): %', array_to_string(_missing, ', ');
  END IF;
END $$;
