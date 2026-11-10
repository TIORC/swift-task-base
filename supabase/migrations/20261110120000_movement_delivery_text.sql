-- Campo "Entrega" da tela Entradas e Saídas: texto livre de até 5000 caracteres por movimentação.
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS delivery_text text
  CHECK (delivery_text IS NULL OR char_length(delivery_text) <= 5000);
