-- ============================================================
-- Cadastra saulo.assis@orcoma.com.br como Solicitante de automações
-- no setor DF (portal /k7f3q9x2/solicitacoes).
-- Usa o código 'DF' (src/types/sectors.ts), igual à Lara (20261110170000).
-- A conta precisa já existir no Auth; se não existir, nada é cadastrado.
-- Idempotente: pode rodar de novo sem duplicar nada.
-- ============================================================

DO $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE lower(email) = 'saulo.assis@orcoma.com.br';

  IF _user_id IS NULL THEN
    RAISE NOTICE 'saulo.assis@orcoma.com.br não encontrado no Auth; nada foi cadastrado';
    RETURN;
  END IF;

  -- 1) Setor do usuário (RLS de automations lê user_sectors.sector)
  INSERT INTO public.user_sectors (user_id, sector)
  VALUES (_user_id, 'DF')
  ON CONFLICT (user_id, sector) DO NOTHING;

  -- 2) Whitelist de solicitantes (gate da tela + policy de insert)
  INSERT INTO public.automation_requesters (user_id, sector, granted_by)
  VALUES (_user_id, 'DF', NULL)
  ON CONFLICT (user_id) DO UPDATE SET sector = EXCLUDED.sector;
END $$;
