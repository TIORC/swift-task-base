-- 1. Colaboradores
CREATE TABLE public.inventory_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  department text NOT NULL,
  job_title text,
  email text,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_collaborators TO authenticated;
GRANT ALL ON public.inventory_collaborators TO service_role;
ALTER TABLE public.inventory_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_collab_select" ON public.inventory_collaborators FOR SELECT TO authenticated USING (true);
CREATE POLICY "inv_collab_write" ON public.inventory_collaborators FOR ALL TO authenticated
  USING (public.has_ti_write(auth.uid())) WITH CHECK (public.has_ti_write(auth.uid()));
CREATE TRIGGER trg_inv_collab_updated BEFORE UPDATE ON public.inventory_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Configurações
CREATE TABLE public.inventory_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  include_damaged_in_value boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.inventory_settings TO authenticated;
GRANT ALL ON public.inventory_settings TO service_role;
ALTER TABLE public.inventory_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_settings_select" ON public.inventory_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "inv_settings_write" ON public.inventory_settings FOR ALL TO authenticated
  USING (public.has_ti_write(auth.uid())) WITH CHECK (public.has_ti_write(auth.uid()));
INSERT INTO public.inventory_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- 3. Itens
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS in_use_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discarded_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS responsible_collaborator_id uuid REFERENCES public.inventory_collaborators(id);
ALTER TABLE public.inventory_items ALTER COLUMN min_stock SET DEFAULT 2;

-- 4. Patrimônios
ALTER TABLE public.inventory_assets
  ADD COLUMN IF NOT EXISTS collaborator_id uuid REFERENCES public.inventory_collaborators(id),
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS invoice_number text;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_assets_patrimony_unique
  ON public.inventory_assets (lower(patrimony_number));
CREATE UNIQUE INDEX IF NOT EXISTS inventory_assets_serial_unique
  ON public.inventory_assets (lower(serial_number)) WHERE serial_number IS NOT NULL AND serial_number <> '';

-- 5. Movimentações
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS collaborator_id uuid REFERENCES public.inventory_collaborators(id),
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS unit_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS patrimony_number text,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status_from text,
  ADD COLUMN IF NOT EXISTS status_to text;

-- 6. Regras de estoque
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