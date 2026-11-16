-- ============================================================================
-- Almoxarifado: colaborador do lançamento enviado pelo celular.
-- ============================================================================

ALTER TABLE public.inventory_mobile_entries
  ADD COLUMN IF NOT EXISTS collaborator_id uuid;
