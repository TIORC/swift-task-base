-- ============================================================================
-- Almoxarifado: lançamentos enviados pelo celular (aba Mobile).
--
-- O TI digita o lançamento no celular e ele fica pendente aqui até alguém
-- conferir na aba Mobile e lançar oficialmente (save_entry_batch /
-- save_exit_batch). Ao lançar, a linha pendente é removida.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_mobile_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  ti_name text NOT NULL,
  equipamento text NOT NULL,
  categoria_id uuid,
  patrimonio text,
  tipo text NOT NULL CHECK (tipo IN ('in', 'out')),
  data date NOT NULL DEFAULT current_date,
  es_text text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_mobile_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mobile_entries_read" ON public.inventory_mobile_entries;
CREATE POLICY "mobile_entries_read" ON public.inventory_mobile_entries
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "mobile_entries_insert" ON public.inventory_mobile_entries;
CREATE POLICY "mobile_entries_insert" ON public.inventory_mobile_entries
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- Quem lança remove a linha pendente depois de gravar no almoxarifado.
DROP POLICY IF EXISTS "mobile_entries_delete" ON public.inventory_mobile_entries;
CREATE POLICY "mobile_entries_delete" ON public.inventory_mobile_entries
  FOR DELETE TO authenticated USING (true);
