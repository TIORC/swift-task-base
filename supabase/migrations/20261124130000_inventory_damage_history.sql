-- ============================================================================
-- Controle: histórico de danos sem patrimônio (ex.: SSD, webcam, estabilizador).
-- É só histórico: NÃO mexe no estoque (diferente da movimentação de dano).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_damage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  reason text,
  department text,
  collaborator_id uuid REFERENCES public.inventory_collaborators(id) ON DELETE SET NULL,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.inventory_damage_history TO authenticated;
GRANT ALL ON public.inventory_damage_history TO service_role;

ALTER TABLE public.inventory_damage_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "damage_history_select" ON public.inventory_damage_history;
CREATE POLICY "damage_history_select" ON public.inventory_damage_history
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "damage_history_insert" ON public.inventory_damage_history;
CREATE POLICY "damage_history_insert" ON public.inventory_damage_history
  FOR INSERT TO authenticated WITH CHECK (public.has_ti_write(auth.uid()));

DROP POLICY IF EXISTS "damage_history_delete" ON public.inventory_damage_history;
CREATE POLICY "damage_history_delete" ON public.inventory_damage_history
  FOR DELETE TO authenticated USING (public.has_ti_write(auth.uid()));
