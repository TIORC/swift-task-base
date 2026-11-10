-- ============================================================================
-- Almoxarifado: Container (dados descartados) + limpeza do almoxarifado
--
-- arquivar_almoxarifado() copia TODOS os dados do almoxarifado para a tabela
-- inventory_container (um lote por execução, em JSON) e só depois apaga os
-- registros das tabelas ativas. Assim o sistema fica limpo para novos dados,
-- e o conteúdo arquivado continua consultável na aba "Container".
--
-- Mantidos: inventory_settings (configuração) e inventory_stock_resets (auditoria).
-- Permissão: mesma lista de e-mails de zerar_estoque().
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_container (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by uuid,
  performed_by_email text,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_container ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv_container_read" ON public.inventory_container;
CREATE POLICY "inv_container_read" ON public.inventory_container
  FOR SELECT TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) IN (
    'angel.kauan@orcoma.com.br',
    'gabriel.anacleto@orcoma.com.br',
    'sofia.nardes@orcoma.com.br',
    'timaracas@orcoma.com.br',
    'welder@orcoma.com.br'
  ));

-- Sem policies de INSERT/UPDATE/DELETE: o conteúdo só é gravado pela função abaixo.

CREATE OR REPLACE FUNCTION public.arquivar_almoxarifado()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _snapshot jsonb;
  _counts jsonb;
  _id uuid;
BEGIN
  IF _email NOT IN (
    'angel.kauan@orcoma.com.br',
    'sofia.nardes@orcoma.com.br',
    'welder@orcoma.com.br',
    'timaracas@orcoma.com.br'
  ) THEN
    RAISE EXCEPTION 'Sem permissão para limpar o almoxarifado';
  END IF;

  _snapshot := jsonb_build_object(
    'inventory_categories',    coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.inventory_categories t), '[]'::jsonb),
    'inventory_locations',     coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.inventory_locations t), '[]'::jsonb),
    'inventory_departments',   coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.inventory_departments t), '[]'::jsonb),
    'inventory_collaborators', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.inventory_collaborators t), '[]'::jsonb),
    'inventory_items',         coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.inventory_items t), '[]'::jsonb),
    'inventory_assets',        coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.inventory_assets t), '[]'::jsonb),
    'inventory_movements',     coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.inventory_movements t), '[]'::jsonb),
    'inventory_requests',      coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM public.inventory_requests t), '[]'::jsonb)
  );

  _counts := (
    SELECT jsonb_object_agg(key, jsonb_array_length(value))
    FROM jsonb_each(_snapshot)
  );

  INSERT INTO public.inventory_container (performed_by, performed_by_email, counts, snapshot)
  VALUES (auth.uid(), _email, _counts, _snapshot)
  RETURNING id INTO _id;

  -- Movimentações: o trigger de estoque não precisa rodar, pois os itens também serão apagados.
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_apply_movement' AND tgrelid = 'public.inventory_movements'::regclass
  ) THEN
    ALTER TABLE public.inventory_movements DISABLE TRIGGER trg_apply_movement;
    DELETE FROM public.inventory_movements WHERE true;
    ALTER TABLE public.inventory_movements ENABLE TRIGGER trg_apply_movement;
  ELSE
    DELETE FROM public.inventory_movements WHERE true;
  END IF;

  DELETE FROM public.inventory_requests WHERE true;
  DELETE FROM public.inventory_assets WHERE true;
  DELETE FROM public.inventory_items WHERE true;
  DELETE FROM public.inventory_categories WHERE true;
  DELETE FROM public.inventory_locations WHERE true;
  DELETE FROM public.inventory_departments WHERE true;
  DELETE FROM public.inventory_collaborators WHERE true;

  RETURN jsonb_build_object('id', _id, 'counts', _counts);
END;
$function$;

REVOKE ALL ON FUNCTION public.arquivar_almoxarifado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.arquivar_almoxarifado() TO authenticated;
