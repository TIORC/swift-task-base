-- ============================================================
-- timaracas@orcoma.com.br como Desenvolvedor (setor TI) em /k7f3q9x2/solicitacoes.
--   1) Troca o papel de teste 'lider' (20261028160000) por 'dev'.
--      A Edge Function lê user_roles com maybeSingle(): com dois papéis
--      ela falha, por isso o 'lider' precisa sair.
--   2) Acesso ao sistema TI, vínculo com o setor TI e whitelist de
--      solicitantes (sem a whitelist a identificação devolve 403).
-- ============================================================

DO $$
DECLARE
  _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = 'timaracas@orcoma.com.br';
  IF _uid IS NULL THEN
    RAISE NOTICE 'timaracas@orcoma.com.br não existe no Auth; nada foi alterado.';
    RETURN;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _uid AND role = 'lider'::app_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'dev'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_systems (user_id, system, enabled)
  VALUES (_uid, 'ti', true)
  ON CONFLICT (user_id, system) DO UPDATE SET enabled = true;

  INSERT INTO public.user_sectors (user_id, sector)
  VALUES (_uid, 'TI')
  ON CONFLICT (user_id, sector) DO NOTHING;

  INSERT INTO public.automation_requesters (user_id, sector, granted_by)
  VALUES (_uid, 'TI', NULL)
  ON CONFLICT (user_id) DO UPDATE SET sector = EXCLUDED.sector;
END $$;
