-- ============================================================================
-- Almoxarifado: permite editar lançamentos pendentes da aba Mobile.
--
-- Mesma regra de DELETE: qualquer usuário autenticado pode ajustar a linha
-- pendente durante a conferência.
-- ============================================================================

DROP POLICY IF EXISTS "mobile_entries_update" ON public.inventory_mobile_entries;
CREATE POLICY "mobile_entries_update" ON public.inventory_mobile_entries
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
