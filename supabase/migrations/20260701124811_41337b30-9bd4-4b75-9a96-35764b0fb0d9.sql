
-- ============ helper: quem pode escrever no almoxarifado ============
CREATE OR REPLACE FUNCTION public.has_ti_write(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'gestor'::app_role)
    OR public.has_role(_user_id, 'lider'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_systems
      WHERE user_id = _user_id AND system = 'ti' AND enabled = true
    );
$$;

-- ============ categorias ============
CREATE TABLE public.inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_categories TO authenticated;
GRANT ALL ON public.inventory_categories TO service_role;
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read categories" ON public.inventory_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "ti write categories" ON public.inventory_categories FOR ALL TO authenticated
  USING (public.has_ti_write(auth.uid())) WITH CHECK (public.has_ti_write(auth.uid()));
CREATE TRIGGER trg_inv_categories_updated BEFORE UPDATE ON public.inventory_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ locais ============
CREATE TABLE public.inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_locations TO authenticated;
GRANT ALL ON public.inventory_locations TO service_role;
ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read locations" ON public.inventory_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "ti write locations" ON public.inventory_locations FOR ALL TO authenticated
  USING (public.has_ti_write(auth.uid())) WITH CHECK (public.has_ti_write(auth.uid()));
CREATE TRIGGER trg_inv_locations_updated BEFORE UPDATE ON public.inventory_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ itens ============
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE,
  category_id uuid REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  tracked_individually boolean NOT NULL DEFAULT false,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  ideal_stock integer NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read items" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "ti write items" ON public.inventory_items FOR ALL TO authenticated
  USING (public.has_ti_write(auth.uid())) WITH CHECK (public.has_ti_write(auth.uid()));
CREATE TRIGGER trg_inv_items_updated BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ patrimônios (assets) ============
CREATE TABLE public.inventory_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  patrimony_number text NOT NULL UNIQUE,
  serial_number text,
  value numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','in_use','damaged','discarded','maintenance')),
  location_id uuid REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id),
  acquired_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_assets TO authenticated;
GRANT ALL ON public.inventory_assets TO service_role;
ALTER TABLE public.inventory_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read assets" ON public.inventory_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "ti write assets" ON public.inventory_assets FOR ALL TO authenticated
  USING (public.has_ti_write(auth.uid())) WITH CHECK (public.has_ti_write(auth.uid()));
CREATE TRIGGER trg_inv_assets_updated BEFORE UPDATE ON public.inventory_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ movimentações ============
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  asset_id uuid REFERENCES public.inventory_assets(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('in','out','transfer','damage','discard','adjust','assign','return')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  reason text,
  notes text,
  from_location_id uuid REFERENCES public.inventory_locations(id),
  to_location_id uuid REFERENCES public.inventory_locations(id),
  assigned_to uuid REFERENCES auth.users(id),
  performed_by uuid NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read movements" ON public.inventory_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "ti insert movements" ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK (public.has_ti_write(auth.uid()) AND performed_by = auth.uid());
-- movimentações são imutáveis (histórico); sem UPDATE/DELETE policies

-- ============ solicitações ============
CREATE TABLE public.inventory_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  justification text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','delivered','cancelled')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_requests TO authenticated;
GRANT ALL ON public.inventory_requests TO service_role;
ALTER TABLE public.inventory_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read requests" ON public.inventory_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "any auth create request" ON public.inventory_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());
CREATE POLICY "ti update request" ON public.inventory_requests FOR UPDATE TO authenticated
  USING (public.has_ti_write(auth.uid())) WITH CHECK (public.has_ti_write(auth.uid()));
CREATE POLICY "ti or owner delete request" ON public.inventory_requests FOR DELETE TO authenticated
  USING (public.has_ti_write(auth.uid()) OR requester_id = auth.uid());
CREATE TRIGGER trg_inv_requests_updated BEFORE UPDATE ON public.inventory_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ triggers de negócio ============

-- 1) aplicar movimentação: atualiza estoque / status do patrimônio
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tracked boolean;
  _current int;
BEGIN
  SELECT tracked_individually, quantity INTO _tracked, _current
  FROM public.inventory_items WHERE id = NEW.item_id FOR UPDATE;

  IF NEW.asset_id IS NOT NULL THEN
    -- patrimoniado: atualiza status/local/responsável
    IF NEW.type = 'damage' THEN
      UPDATE public.inventory_assets SET status='damaged', location_id = COALESCE(NEW.to_location_id, location_id) WHERE id = NEW.asset_id;
    ELSIF NEW.type = 'discard' THEN
      UPDATE public.inventory_assets SET status='discarded' WHERE id = NEW.asset_id;
    ELSIF NEW.type = 'assign' OR NEW.type = 'out' THEN
      UPDATE public.inventory_assets
      SET status='in_use', assigned_to = COALESCE(NEW.assigned_to, assigned_to),
          location_id = COALESCE(NEW.to_location_id, location_id)
      WHERE id = NEW.asset_id;
    ELSIF NEW.type = 'return' THEN
      UPDATE public.inventory_assets SET status='available', assigned_to = NULL,
        location_id = COALESCE(NEW.to_location_id, location_id) WHERE id = NEW.asset_id;
    ELSIF NEW.type = 'transfer' THEN
      UPDATE public.inventory_assets SET location_id = COALESCE(NEW.to_location_id, location_id) WHERE id = NEW.asset_id;
    ELSIF NEW.type = 'in' THEN
      UPDATE public.inventory_assets SET status='available',
        location_id = COALESCE(NEW.to_location_id, location_id) WHERE id = NEW.asset_id;
    END IF;
  ELSE
    -- não-patrimoniado: ajusta quantidade
    IF NEW.type IN ('in','adjust') THEN
      UPDATE public.inventory_items SET quantity = quantity + NEW.quantity WHERE id = NEW.item_id;
    ELSIF NEW.type IN ('out','discard','damage') THEN
      IF _current < NEW.quantity THEN
        RAISE EXCEPTION 'Estoque insuficiente: disponível %, solicitado %', _current, NEW.quantity;
      END IF;
      UPDATE public.inventory_items SET quantity = quantity - NEW.quantity WHERE id = NEW.item_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_movement
AFTER INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();

-- 2) impedir exclusão de item com movimentações
CREATE OR REPLACE FUNCTION public.prevent_item_delete_with_movements()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.inventory_movements WHERE item_id = OLD.id) THEN
    RAISE EXCEPTION 'Não é possível excluir item com movimentações. Inative ou descarte.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_item_delete
BEFORE DELETE ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION public.prevent_item_delete_with_movements();

-- ============ seeds mínimos ============
INSERT INTO public.inventory_categories (name, description) VALUES
  ('Equipamentos', 'Computadores, notebooks, monitores'),
  ('Periféricos', 'Teclado, mouse, headset'),
  ('Cabos', 'Cabos de rede, energia, HDMI'),
  ('Acessórios', 'Adaptadores, hubs, suportes'),
  ('Peças', 'Memórias, SSDs, fontes'),
  ('Manutenção', 'Materiais de limpeza e reparo')
ON CONFLICT DO NOTHING;

INSERT INTO public.inventory_locations (name, description) VALUES
  ('Almoxarifado TI', 'Depósito principal'),
  ('Sala TI', 'Sala da equipe de TI')
ON CONFLICT DO NOTHING;
