-- Gabriel e Welder podem excluir automações (além do criador e dos admins).
-- Policies permissivas são somadas (OR) às já existentes, então nada é restringido para os demais.
-- A exclusão remove em cascata etapas, comentários, eventos, bloqueios e tempos (ON DELETE CASCADE).

DROP POLICY IF EXISTS "automations_team_delete" ON public.automations;
CREATE POLICY "automations_team_delete" ON public.automations
  FOR DELETE TO authenticated
  USING (
    lower(coalesce(auth.jwt() ->> 'email', '')) IN (
      'timaracas@orcoma.com.br',
      'gabriel.anacleto@orcoma.com.br',
      'welder@orcoma.com.br'
    )
  );
