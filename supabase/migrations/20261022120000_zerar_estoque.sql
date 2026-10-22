-- ============================================================================
-- Zerar estoque do almoxarifado (somente Angel, Sofia e Welder)
--
-- Zera a quantidade disponível (inventory_items.quantity) de todos os itens.
-- Nada é excluído: cadastros, movimentações, patrimônios e colaboradores
-- continuam no banco. Antes de zerar, grava-se um snapshot com as quantidades
-- anteriores em inventory_stock_resets, para auditoria.
-- Entradas feitas depois passam a contar a partir de zero.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_stock_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by uuid,
  performed_by_email text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_stock_resets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv_stock_resets_read" ON public.inventory_stock_resets;
CREATE POLICY "inv_stock_resets_read" ON public.inventory_stock_resets
  FOR SELECT TO authenticated
  USING (public.has_inventory_admin());

CREATE OR REPLACE FUNCTION public.zerar_estoque()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _snapshot jsonb;
  _count integer;
BEGIN
  IF _email NOT IN (
    'angel.kauan@orcoma.com.br',
    'sofia.nardes@orcoma.com.br',
    'welder@orcoma.com.br',
    'timaracas@orcoma.com.br'
  ) THEN
    RAISE EXCEPTION 'Sem permissão para zerar o estoque';
  END IF;

  SELECT coalesce(jsonb_object_agg(id::text, quantity), '{}'::jsonb), count(*)::integer
    INTO _snapshot, _count
  FROM public.inventory_items
  WHERE quantity > 0;

  IF _count = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.inventory_stock_resets (performed_by, performed_by_email, snapshot)
  VALUES (auth.uid(), _email, _snapshot);

  UPDATE public.inventory_items
  SET quantity = 0, updated_at = now()
  WHERE quantity > 0;

  RETURN _count;
END;
$function$;

REVOKE ALL ON FUNCTION public.zerar_estoque() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zerar_estoque() TO authenticated;
