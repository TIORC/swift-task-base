-- ============================================================================
-- Salvamento em lote da tela de Patrimônios ("Edição Estilo Excel").
--
-- Mesmo modelo dos lotes de entradas e saídas: valida conflitos antes, grava
-- tudo numa única transação. Patrimônio não gera movimentação (igual ao
-- cadastro atual), então a função só grava os campos do bem.
--
-- Linhas aceitas:
--   kind = 'update' : altera um patrimônio existente. "original" traz os
--                     valores lidos pela tela; se algo mudou, nada é gravado.
--   kind = 'new'    : cadastra um patrimônio novo para um item.
-- SECURITY INVOKER: as políticas RLS de inventory_assets continuam valendo.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_asset_batch(_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  r jsonb;
  idx int := 0;
  _asset public.inventory_assets%ROWTYPE;
  _pat text;
  _serial text;
  _dept text;
  _status text;
  _value numeric;
  _item_id uuid;
  _loc uuid;
  _collab uuid;
  _conflicts jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF jsonb_typeof(_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Formato inválido';
  END IF;

  -- Passo 1: conflitos nos patrimônios existentes. Não grava nada aqui.
  FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    IF r->>'kind' = 'update' THEN
      SELECT * INTO _asset FROM public.inventory_assets WHERE id = (r->>'id')::uuid;
      IF NOT FOUND THEN
        _conflicts := _conflicts || jsonb_build_array(jsonb_build_object('id', r->>'id', 'reason', 'removida'));
      ELSIF _asset.item_id::text IS DISTINCT FROM r#>>'{original,item_id}'
         OR _asset.patrimony_number IS DISTINCT FROM r#>>'{original,patrimony_number}'
         OR COALESCE(_asset.serial_number, '') IS DISTINCT FROM COALESCE(r#>>'{original,serial_number}', '')
         OR _asset.value IS DISTINCT FROM (r#>>'{original,value}')::numeric
         OR _asset.status IS DISTINCT FROM r#>>'{original,status}'
         OR _asset.location_id::text IS DISTINCT FROM r#>>'{original,location_id}'
         OR _asset.collaborator_id::text IS DISTINCT FROM r#>>'{original,collaborator_id}'
         OR COALESCE(_asset.department, '') IS DISTINCT FROM COALESCE(r#>>'{original,department}', '') THEN
        _conflicts := _conflicts || jsonb_build_array(jsonb_build_object('id', r->>'id', 'reason', 'alterada'));
      END IF;
    END IF;
  END LOOP;

  IF jsonb_array_length(_conflicts) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'conflicts', _conflicts);
  END IF;

  -- Passo 2: grava tudo. Qualquer RAISE aqui desfaz o lote inteiro.
  FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    idx := idx + 1;
    _pat := NULLIF(btrim(COALESCE(r->>'patrimony_number', '')), '');
    _serial := NULLIF(btrim(COALESCE(r->>'serial_number', '')), '');
    _dept := NULLIF(btrim(COALESCE(r->>'department', '')), '');
    _status := COALESCE(NULLIF(r->>'status', ''), 'available');
    _value := COALESCE((r->>'value')::numeric, 0);
    _item_id := NULLIF(r->>'item_id', '')::uuid;
    _loc := NULLIF(r->>'location_id', '')::uuid;
    _collab := NULLIF(r->>'collaborator_id', '')::uuid;

    IF _item_id IS NULL THEN
      RAISE EXCEPTION 'Linha %: selecione o item', idx;
    END IF;
    IF _pat IS NULL THEN
      RAISE EXCEPTION 'Linha %: nº de patrimônio é obrigatório', idx;
    END IF;
    IF _value < 0 THEN
      RAISE EXCEPTION 'Linha %: valor não pode ser negativo', idx;
    END IF;
    IF _status NOT IN ('available', 'in_use', 'damaged', 'discarded', 'maintenance') THEN
      RAISE EXCEPTION 'Linha %: status inválido', idx;
    END IF;

    -- Patrimônio e nº de série são únicos (sem diferenciar maiúsculas).
    IF EXISTS (
      SELECT 1 FROM public.inventory_assets a
       WHERE lower(a.patrimony_number) = lower(_pat)
         AND (r->>'kind' = 'new' OR a.id IS DISTINCT FROM (r->>'id')::uuid)
    ) THEN
      RAISE EXCEPTION 'Linha %: patrimônio % já cadastrado', idx, _pat;
    END IF;
    IF _serial IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.inventory_assets a
       WHERE lower(a.serial_number) = lower(_serial)
         AND (r->>'kind' = 'new' OR a.id IS DISTINCT FROM (r->>'id')::uuid)
    ) THEN
      RAISE EXCEPTION 'Linha %: nº de série % já cadastrado', idx, _serial;
    END IF;

    IF r->>'kind' = 'update' THEN
      UPDATE public.inventory_assets
         SET item_id = _item_id,
             patrimony_number = _pat,
             serial_number = _serial,
             value = _value,
             status = _status,
             location_id = _loc,
             collaborator_id = _collab,
             department = _dept
       WHERE id = (r->>'id')::uuid;

    ELSIF r->>'kind' = 'new' THEN
      INSERT INTO public.inventory_assets (
        item_id, patrimony_number, serial_number, value, status, location_id, collaborator_id, department
      ) VALUES (
        _item_id, _pat, _serial, _value, _status, _loc, _collab, _dept
      );

    ELSE
      RAISE EXCEPTION 'Linha %: tipo de linha desconhecido', idx;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'count', idx);
END;
$function$;
