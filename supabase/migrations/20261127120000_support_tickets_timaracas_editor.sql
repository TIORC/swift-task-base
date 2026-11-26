-- ============================================================================
-- /support: o TI Maracas edita chamados ([Chamado]) mesmo com papel de gestor.
-- Políticas permissivas são somadas (OR) às já existentes; a exclusão já é
-- liberada para este usuário pela política super_deleter_delete.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_support_ticket_editor()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'timaracas@orcoma.com.br';
$function$;

DROP POLICY IF EXISTS "TI Maracas can update support tickets" ON public.tasks;
CREATE POLICY "TI Maracas can update support tickets" ON public.tasks
FOR UPDATE TO authenticated
USING (title LIKE '[Chamado]%' AND public.is_support_ticket_editor())
WITH CHECK (title LIKE '[Chamado]%' AND public.is_support_ticket_editor());
