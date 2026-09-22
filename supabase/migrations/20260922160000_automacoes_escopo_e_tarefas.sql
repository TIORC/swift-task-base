-- ============================================================
-- /automacoes: separação entre Itens de Escopo (solicitante)
-- e Tarefas (dev) — Barra de Escopo e Barra de Execução.
-- Mudança aditiva, sem apagar dados existentes.
-- ============================================================

-- Itens de escopo (checklist do solicitante)
CREATE TABLE IF NOT EXISTS public.automation_scope_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  description text NOT NULL,
  concluded boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_scope_items_automation
  ON public.automation_scope_items(automation_id);

-- Tarefas (automation_subtasks) podem apontar para um item de escopo
ALTER TABLE public.automation_subtasks
  ADD COLUMN IF NOT EXISTS item_escopo_id uuid REFERENCES public.automation_scope_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_automation_subtasks_item_escopo
  ON public.automation_subtasks(item_escopo_id);

-- Notificações: o app já grava tipos além da restrição original
-- ('mention','assigned','approval'), ex. 'automation_update'. Remove a
-- restrição se ainda existir para não quebrar os novos avisos.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- RLS (mesmo estilo permissivo das demais tabelas de automação)
ALTER TABLE public.automation_scope_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read automation_scope_items" ON public.automation_scope_items;
CREATE POLICY "Auth read automation_scope_items"
  ON public.automation_scope_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert automation_scope_items" ON public.automation_scope_items;
CREATE POLICY "Authenticated insert automation_scope_items"
  ON public.automation_scope_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update automation_scope_items" ON public.automation_scope_items;
CREATE POLICY "Authenticated update automation_scope_items"
  ON public.automation_scope_items FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated delete automation_scope_items" ON public.automation_scope_items;
CREATE POLICY "Authenticated delete automation_scope_items"
  ON public.automation_scope_items FOR DELETE TO authenticated USING (true);