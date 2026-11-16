-- ============================================================================
-- Almoxarifado: novos tipos de controle no lançamento pelo celular.
-- Além de Entrada e Saída, agora: Patrimônio e Ativos.
-- ============================================================================

ALTER TABLE public.inventory_mobile_entries
  DROP CONSTRAINT IF EXISTS inventory_mobile_entries_tipo_check;

ALTER TABLE public.inventory_mobile_entries
  ADD CONSTRAINT inventory_mobile_entries_tipo_check
  CHECK (tipo IN ('in', 'out', 'patrimonio', 'ativos'));
