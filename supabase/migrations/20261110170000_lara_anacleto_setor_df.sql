-- ============================================================
-- Corrige o setor de lara.anacleto@orcoma.com.br para o CÓDIGO 'DF'.
-- Automações (automations.sector) são gravadas com os códigos de SECTORS
-- (src/types/sectors.ts: DF, DC, DS...). A migration 20261110160000 gravou
-- 'Fiscal', e por isso os sistemas do setor não aparecem para ela (filtro
-- exato de sector no portal e policy has_sector_access).
-- Remove a linha 'Fiscal' e grava 'DF'. Idempotente.
-- ============================================================

DO $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE lower(email) = 'lara.anacleto@orcoma.com.br';

  IF _user_id IS NULL THEN
    RAISE NOTICE 'lara.anacleto@orcoma.com.br não encontrado no Auth; nada foi alterado';
    RETURN;
  END IF;

  -- 1) Setor do usuário (RLS de automations lê user_sectors.sector)
  DELETE FROM public.user_sectors
  WHERE user_id = _user_id AND sector = 'Fiscal';

  INSERT INTO public.user_sectors (user_id, sector)
  VALUES (_user_id, 'DF')
  ON CONFLICT (user_id, sector) DO NOTHING;

  -- 2) Whitelist de solicitantes (o portal filtra sistemas por este setor)
  INSERT INTO public.automation_requesters (user_id, sector, granted_by)
  VALUES (_user_id, 'DF', NULL)
  ON CONFLICT (user_id) DO UPDATE SET sector = EXCLUDED.sector;
END $$;
