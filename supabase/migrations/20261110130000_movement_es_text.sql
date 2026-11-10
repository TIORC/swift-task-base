-- Campo "E&S" da tela Entradas e Saídas: texto livre de até 1000 caracteres por movimentação.
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS es_text text
  CHECK (es_text IS NULL OR char_length(es_text) <= 1000);
