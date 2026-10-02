-- Atualização (upgrade) de item do almoxarifado.
--
-- Objetivo: permitir registrar no banco que um item sofreu atualização, com o
-- antes/depois do que mudou, sem mexer nas quantidades de estoque.
--
-- O novo tipo 'upgrade' entra no CHECK de inventory_movements. Nenhum dos ramos
-- de public.apply_inventory_movement() trata 'upgrade', então a movimentação é
-- puramente de histórico: o trigger não altera quantity/in_use_quantity/
-- damaged_quantity/discarded_quantity nem o status do patrimônio. O mesmo vale
-- para public.revert_inventory_movement(), então apagar ou editar a linha
-- também não mexe no estoque.

-- 1) Libera o novo tipo de movimentação
ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_type_check;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_type_check
  CHECK (type IN ('in','out','transfer','damage','discard','adjust','assign','return','upgrade'));

-- 2) Guarda o antes/depois da atualização dentro da própria movimentação
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS upgrade_details jsonb;

-- 3) Marca no próprio item que ele já passou por atualização
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS last_upgrade_at timestamptz,
  ADD COLUMN IF NOT EXISTS upgrade_count integer NOT NULL DEFAULT 0;
