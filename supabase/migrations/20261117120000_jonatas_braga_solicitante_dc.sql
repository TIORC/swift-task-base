-- ============================================================
-- Cadastra jonatas.braga@orcoma.com.br como Solicitante de automações
-- no setor DC (portal /k7f3q9x2/solicitacoes).
-- A conta já existe no Auth. Remove o papel 'suporte' (o portal mostrava
-- "Você está cadastrado como Suporte TI"; ele é só Solicitante). Acessos a
-- sistemas não são alterados. Idempotente.
-- Mesmo padrão de 20261110160000 (Lara) e 20261028160000 (João Pedro).
-- ============================================================

DO $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE lower(email) = 'jonatas.braga@orcoma.com.br';

  IF _user_id IS NULL THEN
    RAISE NOTICE 'jonatas.braga@orcoma.com.br não encontrado no Auth; nada foi alterado';
    RETURN;
  END IF;

  -- 0) Remove o papel de suporte: o portal mostra o papel como "Suporte TI" no lugar de "Solicitante"
  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = 'suporte'::app_role;

  -- 1) Setor do usuário (RLS de automations lê user_sectors.sector)
  INSERT INTO public.user_sectors (user_id, sector)
  VALUES (_user_id, 'DC')
  ON CONFLICT (user_id, sector) DO NOTHING;

  -- 2) Whitelist de solicitantes (gate da tela + policy de insert)
  INSERT INTO public.automation_requesters (user_id, sector, granted_by)
  VALUES (_user_id, 'DC', NULL)
  ON CONFLICT (user_id) DO UPDATE SET sector = EXCLUDED.sector;
END $$;
