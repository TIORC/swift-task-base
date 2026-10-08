-- ============================================================================
-- Salvamento em lote da tela de Entradas ("Edição Estilo Excel").
--
-- Recebe todas as linhas editadas de uma vez e grava tudo numa única
-- transação (a função inteira é atômica: se uma linha falhar, nada é gravado).
--
-- Linhas aceitas:
--   kind = 'update' : altera uma entrada existente (type 'in').
--                     Envia "original" com os valores que a tela leu; se o
--                     registro mudou desde então, nada é gravado e a função
--                     devolve os conflitos.
--   kind = 'new'    : cria item (ou reaproveita nada) + movimentação 'in'.
--                     Sempre no local "Almoxarifado TI" e exige confirmação
--                     de compra.
--
-- O estoque não é mexido aqui: o trigger trg_apply_movement já recalcula o
-- item a cada INSERT/UPDATE de movimentação.
-- SECURITY INVOKER: as políticas RLS de inventory_* continuam valendo.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_entry_batch(_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  r jsonb;
  idx int := 0;
  _loc uuid;
  _mov public.inventory_movements%ROWTYPE;
  _asset public.inventory_assets%ROWTYPE;
  _item_id uuid;
  _name text;
  _brand text;
  _model text;
  _pat text;
  _serial text;
  _obs text;
  _qty int;
  _price numeric;
  _occurred timestamptz;
  _entry_date date;
  _purchased boolean;
  _item_name text;
  _item_brand text;
  _item_model text;
  _conflicts jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF jsonb_typeof(_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Formato inválido';
  END IF;

  SELECT l.id INTO _loc
    FROM public.inventory_locations l
   WHERE lower(btrim(l.name)) = 'almoxarifado ti'
   LIMIT 1;

  -- Passo 1: checa conflitos nas entradas existentes. Não grava nada aqui.
  FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    IF r->>'kind' = 'update' THEN
      SELECT * INTO _mov FROM public.inventory_movements WHERE id = (r->>'id')::uuid;
      SELECT i.name, i.brand, i.model INTO _item_name, _item_brand, _item_model
        FROM public.inventory_items i WHERE i.id = _mov.item_id;
      IF NOT FOUND THEN
        _conflicts := _conflicts || jsonb_build_array(jsonb_build_object('id', r->>'id', 'reason', 'removida'));
      ELSIF _mov.quantity IS DISTINCT FROM (r#>>'{original,quantity}')::int
         OR _mov.unit_price IS DISTINCT FROM (r#>>'{original,unit_price}')::numeric
         OR _mov.occurred_at IS DISTINCT FROM (r#>>'{original,occurred_at}')::timestamptz
         OR COALESCE(_mov.notes, '') IS DISTINCT FROM COALESCE(r#>>'{original,notes}', '')
         OR COALESCE(_mov.patrimony_number, '') IS DISTINCT FROM COALESCE(r#>>'{original,patrimony_number}', '')
         OR COALESCE(_item_name, '') IS DISTINCT FROM COALESCE(r#>>'{original,name}', '')
         OR COALESCE(_item_brand, '') IS DISTINCT FROM COALESCE(r#>>'{original,brand}', '')
         OR COALESCE(_item_model, '') IS DISTINCT FROM COALESCE(r#>>'{original,model}', '') THEN
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
    _qty := (r->>'quantity')::int;
    _price := COALESCE((r->>'unit_price')::numeric, 0);
    _occurred := (r->>'occurred_at')::timestamptz;
    _obs := NULLIF(btrim(COALESCE(r->>'notes', '')), '');

    IF _qty IS NULL OR _qty < 1 THEN
      RAISE EXCEPTION 'Linha %: quantidade deve ser maior que zero', idx;
    END IF;
    IF _price < 0 THEN
      RAISE EXCEPTION 'Linha %: valor unitário não pode ser negativo', idx;
    END IF;
    IF _occurred IS NULL THEN
      RAISE EXCEPTION 'Linha %: data e hora da chegada são obrigatórias', idx;
    END IF;

    IF r->>'kind' = 'update' THEN
      SELECT * INTO _mov FROM public.inventory_movements WHERE id = (r->>'id')::uuid FOR UPDATE;
      IF _mov.type <> 'in' THEN
        RAISE EXCEPTION 'Linha %: só é possível editar entradas', idx;
      END IF;
      IF _mov.asset_id IS NOT NULL AND _qty <> 1 THEN
        RAISE EXCEPTION 'Linha %: bem patrimoniado tem quantidade sempre 1', idx;
      END IF;

      _name := NULLIF(btrim(COALESCE(r->>'name', '')), '');
      IF _name IS NULL THEN
        RAISE EXCEPTION 'Linha %: nome do item é obrigatório', idx;
      END IF;
      _pat := NULLIF(btrim(COALESCE(r->>'patrimony_number', '')), '');
      _brand := NULLIF(btrim(COALESCE(r->>'brand', '')), '');
      _model := NULLIF(btrim(COALESCE(r->>'model', '')), '');
      _purchased := COALESCE(r->>'purchased', 'false') = 'true';

      -- Patrimônio: renomeia o bem vinculado ao número antigo (se existir).
      IF _pat IS DISTINCT FROM _mov.patrimony_number THEN
        IF _mov.patrimony_number IS NOT NULL AND _pat IS NULL THEN
          RAISE EXCEPTION 'Linha %: não é possível remover o patrimônio de uma entrada', idx;
        END IF;
        IF _pat IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.inventory_assets
           WHERE lower(patrimony_number) = lower(_pat)
             AND lower(patrimony_number) <> lower(COALESCE(_mov.patrimony_number, ''))
        ) THEN
          RAISE EXCEPTION 'Linha %: patrimônio % já cadastrado em outro bem', idx, _pat;
        END IF;
        IF _mov.patrimony_number IS NOT NULL THEN
          UPDATE public.inventory_assets SET patrimony_number = _pat
           WHERE lower(patrimony_number) = lower(_mov.patrimony_number);
        END IF;
      END IF;

      -- Marca e modelo pertencem ao item (valem para todas as entradas dele).
      UPDATE public.inventory_items SET name = _name, brand = _brand, model = _model WHERE id = _mov.item_id;

      UPDATE public.inventory_movements
         SET quantity = _qty,
             unit_price = _price,
             occurred_at = _occurred,
             patrimony_number = _pat,
             notes = CASE WHEN _purchased
                          THEN 'Item comprado (confirmado pela infraestrutura)' || COALESCE(' — ' || _obs, '')
                          ELSE _obs END
       WHERE id = _mov.id;

    ELSIF r->>'kind' = 'new' THEN
      IF _loc IS NULL THEN
        RAISE EXCEPTION 'Local "Almoxarifado TI" não cadastrado';
      END IF;
      IF COALESCE(r->>'purchased', 'false') <> 'true' THEN
        RAISE EXCEPTION 'Linha %: confirme que o item é comprado', idx;
      END IF;

      _entry_date := (r->>'entry_date')::date;
      _name := NULLIF(btrim(COALESCE(r->>'name', '')), '');
      IF _name IS NULL THEN
        RAISE EXCEPTION 'Linha %: nome do item é obrigatório', idx;
      END IF;
      _brand := NULLIF(btrim(COALESCE(r->>'brand', '')), '');
      _model := NULLIF(btrim(COALESCE(r->>'model', '')), '');
      _pat := NULLIF(btrim(COALESCE(r->>'patrimony_number', '')), '');
      _serial := NULLIF(btrim(COALESCE(r->>'serial_number', '')), '');

      INSERT INTO public.inventory_items (
        name, brand, model, location_id, tracked_individually, unit_price,
        min_stock, ideal_stock, quantity, status, created_by
      ) VALUES (
        _name, _brand, _model, _loc, false, _price,
        2, 0, 0, 'active', auth.uid()
      ) RETURNING id INTO _item_id;

      IF _pat IS NOT NULL THEN
        SELECT * INTO _asset FROM public.inventory_assets
         WHERE lower(patrimony_number) = lower(_pat) LIMIT 1;

        IF _serial IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.inventory_assets
           WHERE lower(serial_number) = lower(_serial)
             AND id IS DISTINCT FROM _asset.id
        ) THEN
          RAISE EXCEPTION 'Linha %: nº de série já cadastrado em outro patrimônio', idx;
        END IF;

        IF _asset.id IS NOT NULL THEN
          UPDATE public.inventory_assets
             SET serial_number = _serial,
                 value = _price,
                 location_id = _loc,
                 acquired_at = _entry_date
           WHERE id = _asset.id;
        ELSE
          INSERT INTO public.inventory_assets (
            item_id, patrimony_number, serial_number, value, status, location_id, acquired_at
          ) VALUES (
            _item_id, _pat, _serial, _price, 'available', _loc, _entry_date
          );
        END IF;
      END IF;

      INSERT INTO public.inventory_movements (
        item_id, type, quantity, unit_price, patrimony_number, serial_number,
        to_location_id, occurred_at, reason, notes, status_from, status_to, performed_by
      ) VALUES (
        _item_id, 'in', _qty, _price, _pat, _serial,
        _loc, _occurred, 'Entrada de estoque',
        'Item comprado (confirmado pela infraestrutura)' || COALESCE(' — ' || _obs, ''),
        NULL, 'available', auth.uid()
      );

    ELSE
      RAISE EXCEPTION 'Linha %: tipo de linha desconhecido', idx;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'count', idx);
END;
$function$;
