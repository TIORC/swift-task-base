-- ============================================================================
-- Salvamento em lote da tela de Saídas ("Edição Estilo Excel").
--
-- Mesmo modelo de save_entry_batch: valida conflitos antes, grava tudo numa
-- única transação e deixa o estoque para o trigger trg_apply_movement.
--
-- Linhas aceitas:
--   kind = 'update' : altera uma saída existente (type 'out' ou 'assign').
--                     Envia "original" com os valores lidos pela tela.
--   kind = 'new'    : cria uma saída de item existente para um responsável.
--                     Sem patrimônio informado, vincula os patrimônios
--                     disponíveis do item, como o fluxo de saída já faz.
-- Toda saída exige responsável.
-- SECURITY INVOKER: as políticas RLS de inventory_* continuam valendo.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_exit_batch(_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  r jsonb;
  idx int := 0;
  _mov public.inventory_movements%ROWTYPE;
  _asset public.inventory_assets%ROWTYPE;
  _item public.inventory_items%ROWTYPE;
  _collab uuid;
  _collab_dept text;
  _dept text;
  _item_id uuid;
  _name text;
  _pat text;
  _obs text;
  _reason text;
  _qty int;
  _occurred timestamptz;
  _conflicts jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF jsonb_typeof(_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Formato inválido';
  END IF;

  -- Passo 1: conflitos nas saídas existentes. Não grava nada aqui.
  FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    IF r->>'kind' = 'update' THEN
      SELECT * INTO _mov FROM public.inventory_movements WHERE id = (r->>'id')::uuid;
      IF NOT FOUND THEN
        _conflicts := _conflicts || jsonb_build_array(jsonb_build_object('id', r->>'id', 'reason', 'removida'));
      ELSIF _mov.quantity IS DISTINCT FROM (r#>>'{original,quantity}')::int
         OR _mov.occurred_at IS DISTINCT FROM (r#>>'{original,occurred_at}')::timestamptz
         OR _mov.collaborator_id::text IS DISTINCT FROM r#>>'{original,collaborator_id}'
         OR COALESCE(_mov.department, '') IS DISTINCT FROM COALESCE(r#>>'{original,department}', '')
         OR COALESCE(_mov.reason, '') IS DISTINCT FROM COALESCE(r#>>'{original,reason}', '')
         OR COALESCE(_mov.notes, '') IS DISTINCT FROM COALESCE(r#>>'{original,notes}', '')
         OR COALESCE(_mov.patrimony_number, '') IS DISTINCT FROM COALESCE(r#>>'{original,patrimony_number}', '')
         OR COALESCE((SELECT i.name FROM public.inventory_items i WHERE i.id = _mov.item_id), '')
            IS DISTINCT FROM COALESCE(r#>>'{original,name}', '') THEN
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
    _occurred := (r->>'occurred_at')::timestamptz;
    _obs := NULLIF(btrim(COALESCE(r->>'notes', '')), '');
    _reason := NULLIF(btrim(COALESCE(r->>'reason', '')), '');
    _pat := NULLIF(btrim(COALESCE(r->>'patrimony_number', '')), '');
    _dept := NULLIF(btrim(COALESCE(r->>'department', '')), '');
    _name := NULLIF(btrim(COALESCE(r->>'name', '')), '');

    IF _qty IS NULL OR _qty < 1 THEN
      RAISE EXCEPTION 'Linha %: quantidade deve ser maior que zero', idx;
    END IF;
    IF _occurred IS NULL THEN
      RAISE EXCEPTION 'Linha %: data e hora da saída são obrigatórias', idx;
    END IF;
    IF _name IS NULL THEN
      RAISE EXCEPTION 'Linha %: nome do item é obrigatório', idx;
    END IF;

    _collab := NULLIF(r->>'collaborator_id', '')::uuid;
    IF _collab IS NULL THEN
      RAISE EXCEPTION 'Linha %: toda saída exige um responsável', idx;
    END IF;
    SELECT c.department INTO _collab_dept FROM public.inventory_collaborators c WHERE c.id = _collab;
    _dept := COALESCE(_dept, _collab_dept);

    IF r->>'kind' = 'update' THEN
      SELECT * INTO _mov FROM public.inventory_movements WHERE id = (r->>'id')::uuid FOR UPDATE;
      IF _mov.type NOT IN ('out', 'assign') THEN
        RAISE EXCEPTION 'Linha %: só é possível editar saídas', idx;
      END IF;
      IF _mov.asset_id IS NOT NULL AND _qty <> 1 THEN
        RAISE EXCEPTION 'Linha %: bem patrimoniado tem quantidade sempre 1', idx;
      END IF;

      -- Patrimônio: renomeia o bem vinculado ao número antigo, igual à entrada.
      IF _pat IS DISTINCT FROM _mov.patrimony_number THEN
        IF _mov.patrimony_number IS NOT NULL AND _pat IS NULL THEN
          RAISE EXCEPTION 'Linha %: não é possível remover o patrimônio de uma saída', idx;
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

      UPDATE public.inventory_items SET name = _name WHERE id = _mov.item_id;

      -- O trigger desfaz a saída antiga e aplica a nova (checa estoque disponível).
      UPDATE public.inventory_movements
         SET quantity = _qty,
             occurred_at = _occurred,
             collaborator_id = _collab,
             department = _dept,
             reason = _reason,
             patrimony_number = _pat,
             notes = _obs
       WHERE id = _mov.id;

    ELSIF r->>'kind' = 'new' THEN
      _item_id := NULLIF(r->>'item_id', '')::uuid;
      SELECT * INTO _item FROM public.inventory_items WHERE id = _item_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Linha %: selecione o item', idx;
      END IF;
      IF _item.status <> 'active' THEN
        RAISE EXCEPTION 'Linha %: o item está inativo', idx;
      END IF;

      IF _pat IS NOT NULL THEN
        SELECT * INTO _asset FROM public.inventory_assets
         WHERE lower(patrimony_number) = lower(_pat) LIMIT 1;
        IF _asset.id IS NOT NULL THEN
          UPDATE public.inventory_assets
             SET status = 'in_use', collaborator_id = _collab, department = _dept
           WHERE id = _asset.id;
        ELSE
          INSERT INTO public.inventory_assets (
            item_id, patrimony_number, value, status, collaborator_id, department
          ) VALUES (
            _item_id, _pat, _item.unit_price, 'in_use', _collab, _dept
          );
        END IF;
      ELSE
        -- Sem patrimônio: vincula os patrimônios disponíveis do item.
        UPDATE public.inventory_assets
           SET status = 'in_use', collaborator_id = _collab, department = _dept
         WHERE id IN (
           SELECT a.id FROM public.inventory_assets a
            WHERE a.item_id = _item_id AND a.status = 'available'
            ORDER BY a.created_at ASC
            LIMIT _qty
         );
      END IF;

      INSERT INTO public.inventory_movements (
        item_id, type, quantity, unit_price, collaborator_id, department,
        patrimony_number, reason, notes, occurred_at, status_from, status_to, performed_by
      ) VALUES (
        _item_id, 'out', _qty, _item.unit_price, _collab, _dept,
        _pat, COALESCE(_reason, 'Saída para responsável'), _obs, _occurred,
        'available', 'in_use', auth.uid()
      );

    ELSE
      RAISE EXCEPTION 'Linha %: tipo de linha desconhecido', idx;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'count', idx);
END;
$function$;
