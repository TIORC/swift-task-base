-- ============================================================
-- Muda suzane.souza@orcoma.com.br de RH para DP e garante que ela está
-- cadastrada como Solicitante de automações (portal /k7f3q9x2/solicitacoes),
-- e não como Suporte TI.
-- - Remove o papel 'suporte' (o portal mostra "Suporte TI" quando ele existe).
-- - Troca o setor RH por DP em user_sectors (RLS de automations lê esta tabela).
-- - Grava o setor DP na whitelist automation_requesters (gate da tela + insert).
-- Mesmo padrão de 20261117120000 (Jonatas Braga) e 20261110170000 (Lara). Idempotente.
-- ============================================================

DO $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE lower(email) = 'suzane.souza@orcoma.com.br';

  IF _user_id IS NULL THEN
    RAISE NOTICE 'suzane.souza@orcoma.com.br não encontrada no Auth; nada foi alterado';
    RETURN;
  END IF;

  -- 0) Remove o papel de suporte (ela deve aparecer apenas como Solicitante)
  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = 'suporte'::app_role;

  -- 1) Setor do usuário: sai o RH, entra o DP
  DELETE FROM public.user_sectors
  WHERE user_id = _user_id AND sector = 'RH';

  INSERT INTO public.user_sectors (user_id, sector)
  VALUES (_user_id, 'DP')
  ON CONFLICT (user_id, sector) DO NOTHING;

  -- 2) Whitelist de solicitantes (o portal filtra sistemas por este setor)
  INSERT INTO public.automation_requesters (user_id, sector, granted_by)
  VALUES (_user_id, 'DP', NULL)
  ON CONFLICT (user_id) DO UPDATE SET sector = EXCLUDED.sector;
END $$;
