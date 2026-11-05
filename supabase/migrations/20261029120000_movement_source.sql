-- ============================================================================
-- Entrada enviada para saída
--
-- A saída criada a partir de uma entrada guarda o id da entrada de origem.
-- A entrada continua no histórico e no estoque (não é estornada); ela só deixa
-- de aparecer na lista de Entradas.
-- ============================================================================
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS source_movement_id uuid
  REFERENCES public.inventory_movements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inventory_movements_source_idx
  ON public.inventory_movements (source_movement_id);
