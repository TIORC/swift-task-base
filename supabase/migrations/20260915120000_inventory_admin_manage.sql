-- ============================================================================
-- Gestão do almoxarifado restrita a uma lista de e-mails
--
-- Antes, a escrita era liberada por PERFIL (has_ti_write: admin/gestor/lider ou
-- quem tem o sistema "ti"). Agora apenas os e-mails abaixo podem criar,
-- editar e excluir dados do almoxarifado. Todos os usuários autenticados
-- continuam com leitura.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_inventory_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) IN (
    'angel.kauan@orcoma.com.br',
    'gabriel.anacleto@orcoma.com.br',
    'sofia.nardes@orcoma.com.br',
    'timaracas@orcoma.com.br',
    'welder@orcoma.com.br'
  );
$function$;

-- ---------- categorias / locais / itens / patrimônios / colaboradores / setores / config ----------
DROP POLICY IF EXISTS "ti write categories"   ON public.inventory_categories;
DROP POLICY IF EXISTS "ti write locations"    ON public.inventory_locations;
DROP POLICY IF EXISTS "ti write items"        ON public.inventory_items;
DROP POLICY IF EXISTS "ti write assets"       ON public.inventory_assets;
DROP POLICY IF EXISTS "inv_collab_write"      ON public.inventory_collaborators;
DROP POLICY IF EXISTS "inv_settings_write"    ON public.inventory_settings;
DROP POLICY IF EXISTS "ti write departments"  ON public.inventory_departments;

CREATE POLICY "inv_categories_admin" ON public.inventory_categories FOR ALL TO authenticated
  USING (public.has_inventory_admin()) WITH CHECK (public.has_inventory_admin());
CREATE POLICY "inv_locations_admin" ON public.inventory_locations FOR ALL TO authenticated
  USING (public.has_inventory_admin()) WITH CHECK (public.has_inventory_admin());
CREATE POLICY "inv_items_admin" ON public.inventory_items FOR ALL TO authenticated
  USING (public.has_inventory_admin()) WITH CHECK (public.has_inventory_admin());
CREATE POLICY "inv_assets_admin" ON public.inventory_assets FOR ALL TO authenticated
  USING (public.has_inventory_admin()) WITH CHECK (public.has_inventory_admin());
CREATE POLICY "inv_collab_admin" ON public.inventory_collaborators FOR ALL TO authenticated
  USING (public.has_inventory_admin()) WITH CHECK (public.has_inventory_admin());
CREATE POLICY "inv_settings_admin" ON public.inventory_settings FOR ALL TO authenticated
  USING (public.has_inventory_admin()) WITH CHECK (public.has_inventory_admin());
CREATE POLICY "inv_departments_admin" ON public.inventory_departments FOR ALL TO authenticated
  USING (public.has_inventory_admin()) WITH CHECK (public.has_inventory_admin());

-- ---------- solicitações ----------
DROP POLICY IF EXISTS "ti update request"       ON public.inventory_requests;
DROP POLICY IF EXISTS "ti or owner delete request" ON public.inventory_requests;

CREATE POLICY "inv_requests_admin_update" ON public.inventory_requests FOR UPDATE TO authenticated
  USING (public.has_inventory_admin()) WITH CHECK (public.has_inventory_admin());
CREATE POLICY "inv_requests_admin_delete" ON public.inventory_requests FOR DELETE TO authenticated
  USING (public.has_inventory_admin());

-- ============================================================================
-- Movimentações passam a ser editáveis
--
-- Até aqui não existia policy de UPDATE/DELETE: o histórico era imutável por
-- design. Passa a existir, e para que apagar ou corrigir uma movimentação não
-- deixe o estoque torto, cada linha guarda o pedaço de dado necessário para
-- desfazer exatamente o que ela fez.
-- ============================================================================

DROP POLICY IF EXISTS "ti insert movements" ON public.inventory_movements;

CREATE POLICY "inv_movements_admin_insert" ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_inventory_admin() AND performed_by = auth.uid());
CREATE POLICY "inv_movements_admin_update" ON public.inventory_movements FOR UPDATE TO authenticated
  USING (public.has_inventory_admin()) WITH CHECK (public.has_inventory_admin());
CREATE POLICY "inv_movements_admin_delete" ON public.inventory_movements FOR DELETE TO authenticated
  USING (public.has_inventory_admin());

-- "discard" tira parte do estoque danificado e parte do disponível. Sem guardar
-- esse pedaço não dá para reverter a movimentação de forma exata.
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS damaged_from integer NOT NULL DEFAULT 0;

-- ============================================================================
-- Estorno: desfaz uma movimentação já registrada
-- ============================================================================
CREATE OR REPLACE FUNCTION public.revert_inventory_movement(
  _item_id uuid,
  _asset_id uuid,
  _type text,
  _quantity int,
  _damaged_from int,
  _exclude_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _last_type text;
  _last_loc uuid;
BEGIN
  IF _asset_id IS NULL THEN
    IF _type IN ('in','adjust') THEN
      UPDATE public.inventory_items
      SET quantity = GREATEST(0, quantity - _quantity) WHERE id = _item_id;

    ELSIF _type IN ('out','assign') THEN
      UPDATE public.inventory_items
      SET quantity = quantity + _quantity,
          in_use_quantity = GREATEST(0, in_use_quantity - _quantity)
      WHERE id = _item_id;

    ELSIF _type = 'return' THEN
      UPDATE public.inventory_items
      SET quantity = GREATEST(0, quantity - _quantity),
          in_use_quantity = in_use_quantity + _quantity
      WHERE id = _item_id;

    ELSIF _type = 'damage' THEN
      UPDATE public.inventory_items
      SET quantity = quantity + _quantity,
          damaged_quantity = GREATEST(0, damaged_quantity - _quantity)
      WHERE id = _item_id;

    ELSIF _type = 'discard' THEN
      UPDATE public.inventory_items
      SET damaged_quantity = damaged_quantity + _damaged_from,
          quantity = quantity + (_quantity - _damaged_from),
          discarded_quantity = GREATEST(0, discarded_quantity - _quantity)
      WHERE id = _item_id;
    END IF;

  ELSE
    -- Patrimônio: o status não é armazenado, então é re-derivado do que sobrou
    -- no histórico do próprio bem.
    SELECT m.type, m.to_location_id INTO _last_type, _last_loc
      FROM public.inventory_movements m
     WHERE m.asset_id = _asset_id
       AND m.id <> _exclude_id
     ORDER BY m.occurred_at DESC, m.created_at DESC
     LIMIT 1;

    IF _last_type IS NULL THEN
      UPDATE public.inventory_assets SET status = 'available' WHERE id = _asset_id;
    ELSE
      UPDATE public.inventory_assets
      SET status = CASE _last_type
                     WHEN 'damage'  THEN 'damaged'
                     WHEN 'discard' THEN 'discarded'
                     WHEN 'out'     THEN 'in_use'
                     WHEN 'assign'  THEN 'in_use'
                     WHEN 'return'  THEN 'available'
                     WHEN 'in'      THEN 'available'
                     ELSE status
                   END,
          location_id = COALESCE(_last_loc, location_id)
      WHERE id = _asset_id;
    END IF;
  END IF;
END;
$function$;

-- ============================================================================
-- Trigger único de movimentações: INSERT aplica, DELETE estorna, UPDATE estorna
-- o estado antigo e reaplica o novo.
-- ============================================================================
DROP TRIGGER IF EXISTS trg_apply_movement ON public.inventory_movements;

CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tracked boolean;
  _available int;
  _damaged int;
  _in_use int;
  _from_damaged int;
BEGIN
  IF TG_OP IN ('DELETE','UPDATE') THEN
    PERFORM public.revert_inventory_movement(
      OLD.item_id, OLD.asset_id, OLD.type, OLD.quantity, OLD.damaged_from, OLD.id
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  NEW.damaged_from := 0;

  SELECT tracked_individually, quantity, damaged_quantity, in_use_quantity
    INTO _tracked, _available, _damaged, _in_use
  FROM public.inventory_items WHERE id = NEW.item_id FOR UPDATE;

  IF NEW.asset_id IS NOT NULL THEN
    IF NEW.type = 'damage' THEN
      UPDATE public.inventory_assets SET status='damaged',
        location_id = COALESCE(NEW.to_location_id, location_id) WHERE id = NEW.asset_id;
    ELSIF NEW.type = 'discard' THEN
      UPDATE public.inventory_assets SET status='discarded' WHERE id = NEW.asset_id;
    ELSIF NEW.type IN ('assign','out') THEN
      UPDATE public.inventory_assets
      SET status='in_use',
          assigned_to = COALESCE(NEW.assigned_to, assigned_to),
          collaborator_id = COALESCE(NEW.collaborator_id, collaborator_id),
          department = COALESCE(NEW.department, department),
          location_id = COALESCE(NEW.to_location_id, location_id)
      WHERE id = NEW.asset_id;
    ELSIF NEW.type = 'return' THEN
      UPDATE public.inventory_assets SET status='available', assigned_to = NULL, collaborator_id = NULL,
        location_id = COALESCE(NEW.to_location_id, location_id) WHERE id = NEW.asset_id;
    ELSIF NEW.type = 'transfer' THEN
      UPDATE public.inventory_assets SET location_id = COALESCE(NEW.to_location_id, location_id) WHERE id = NEW.asset_id;
    ELSIF NEW.type = 'in' THEN
      UPDATE public.inventory_assets SET status='available',
        location_id = COALESCE(NEW.to_location_id, location_id) WHERE id = NEW.asset_id;
    END IF;

  ELSE
    IF NEW.type IN ('in','adjust') THEN
      UPDATE public.inventory_items SET quantity = quantity + NEW.quantity WHERE id = NEW.item_id;

    ELSIF NEW.type IN ('out','assign') THEN
      IF _available < NEW.quantity THEN
        RAISE EXCEPTION 'Estoque insuficiente: disponível %, solicitado %', _available, NEW.quantity;
      END IF;
      UPDATE public.inventory_items
      SET quantity = quantity - NEW.quantity,
          in_use_quantity = in_use_quantity + NEW.quantity,
          responsible_collaborator_id = COALESCE(NEW.collaborator_id, responsible_collaborator_id)
      WHERE id = NEW.item_id;

    ELSIF NEW.type = 'return' THEN
      UPDATE public.inventory_items
      SET quantity = quantity + NEW.quantity,
          in_use_quantity = GREATEST(0, in_use_quantity - NEW.quantity),
          responsible_collaborator_id = NULL
      WHERE id = NEW.item_id;

    ELSIF NEW.type = 'damage' THEN
      IF _available < NEW.quantity THEN
        RAISE EXCEPTION 'Quantidade indisponível: disponível %, solicitado %', _available, NEW.quantity;
      END IF;
      UPDATE public.inventory_items
      SET quantity = quantity - NEW.quantity,
          damaged_quantity = damaged_quantity + NEW.quantity
      WHERE id = NEW.item_id;

    ELSIF NEW.type = 'discard' THEN
      _from_damaged := LEAST(_damaged, NEW.quantity);
      IF (_available + _damaged) < NEW.quantity THEN
        RAISE EXCEPTION 'Quantidade indisponível para descarte: %', NEW.quantity;
      END IF;
      NEW.damaged_from := _from_damaged;
      UPDATE public.inventory_items
      SET damaged_quantity = damaged_quantity - _from_damaged,
          quantity = quantity - (NEW.quantity - _from_damaged),
          discarded_quantity = discarded_quantity + NEW.quantity
      WHERE id = NEW.item_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_apply_movement
BEFORE INSERT OR UPDATE OR DELETE ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();