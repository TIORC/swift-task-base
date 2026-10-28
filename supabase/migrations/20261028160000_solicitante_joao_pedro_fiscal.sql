-- ============================================================
-- Cadastra João Pedro (joao.pedro@orcoma.com.br) como Solicitante
-- de automações, no setor Fiscal (portal /k7f3q9x2/solicitacoes).
-- A conta já existe no Auth. Remove o papel 'suporte' que foi dado por
-- engano (ele é só Solicitante). Acessos a sistemas não são alterados.
-- Idempotente.
-- ============================================================

DO $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE lower(email) = 'joao.pedro@orcoma.com.br';

  IF _user_id IS NULL THEN
    RAISE NOTICE 'joao.pedro@orcoma.com.br não encontrado no Auth; nada foi cadastrado';
    RETURN;
  END IF;

  -- 1) Remove o papel de suporte: o portal mostra o papel como "Suporte TI" no lugar de "Solicitante"
  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = 'suporte'::app_role;

  -- 2) Setor do usuário (aparece como "Setor não definido" hoje)
  INSERT INTO public.user_sectors (user_id, sector)
  VALUES (_user_id, 'Fiscal')
  ON CONFLICT (user_id, sector) DO NOTHING;

  -- 3) Whitelist de solicitantes (gate da tela + policy de insert)
  INSERT INTO public.automation_requesters (user_id, sector, granted_by)
  VALUES (_user_id, 'Fiscal', NULL)
  ON CONFLICT (user_id) DO UPDATE SET sector = EXCLUDED.sector;
END $$;
