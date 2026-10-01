-- ============================================================
-- Corrige o e-mail de Sofia (Infra) nas liberações de /solicitacoes.
-- A migration 20261001120000 gravou 'sofia.narde@orcoma.com.br'
-- (sem o "s"), que não existe no Auth — o JOIN falhou e nada foi
-- liberado para ela. O e-mail correto é 'sofia.nardes@orcoma.com.br'.
-- Setor permanece TI. Mudança aditiva e idempotente.
-- ============================================================

DO $$
DECLARE
  _r record;
BEGIN
  FOR _r IN
    SELECT u.id AS user_id, v.role, v.sector
    FROM (VALUES
      ('sofia.nardes@orcoma.com.br', 'suporte'::app_role, 'TI')
    ) AS v(email, role, sector)
    JOIN auth.users u ON u.email = v.email
  LOOP
    -- 1) Papel do usuário
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_r.user_id, _r.role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- 2) Acesso ao sistema TI (necessário para abrir /k7f3q9x2/solicitacoes)
    INSERT INTO public.user_systems (user_id, system, enabled)
    VALUES (_r.user_id, 'ti', true)
    ON CONFLICT (user_id, system) DO UPDATE SET enabled = true;

    -- 3) Vínculo com o setor TI
    INSERT INTO public.user_sectors (user_id, sector)
    VALUES (_r.user_id, _r.sector)
    ON CONFLICT (user_id, sector) DO NOTHING;

    -- 4) Whitelist de solicitantes (gate da tela + policy de insert)
    INSERT INTO public.automation_requesters (user_id, sector, granted_by)
    VALUES (_r.user_id, _r.sector, NULL)
    ON CONFLICT (user_id) DO UPDATE SET sector = EXCLUDED.sector;
  END LOOP;
END $$;

-- Avisa (sem falhar) se o e-mail corrigido ainda não existir no Auth.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'sofia.nardes@orcoma.com.br') THEN
    RAISE NOTICE 'sofia.nardes@orcoma.com.br ainda não cadastrado no Auth (será liberada quando existir)';
  END IF;
END $$;

-- Diagnóstico: roles/setores registrados para Sofia (por e-mail, não por id).
DO $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE email = 'sofia.nardes@orcoma.com.br';
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  RAISE NOTICE 'Sofia (%), papéis: %', _user_id,
    COALESCE((
      SELECT string_agg(r.role::text, ', ')
      FROM public.user_roles r WHERE r.user_id = _user_id
    ), '(nenhum)');

  RAISE NOTICE 'Sofia (%), setores: %', _user_id,
    COALESCE((
      SELECT string_agg(s.sector, ', ')
      FROM public.user_sectors s WHERE s.user_id = _user_id
    ), '(nenhum)');
END $$;