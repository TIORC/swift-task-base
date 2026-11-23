-- ============================================================================
-- /support: editar e excluir itens do catálogo (sistemas, sites, equipamentos
-- e soluções) é só para o TI Maracas. Quem é do TI continua podendo cadastrar.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_support_catalog_editor()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'timaracas@orcoma.com.br';
$function$;

DROP POLICY IF EXISTS "TI can update support catalog" ON public.support_catalog;
CREATE POLICY "TI can update support catalog"
  ON public.support_catalog FOR UPDATE TO authenticated
  USING (public.is_support_catalog_editor())
  WITH CHECK (public.is_support_catalog_editor());

DROP POLICY IF EXISTS "TI can delete support catalog" ON public.support_catalog;
CREATE POLICY "TI can delete support catalog"
  ON public.support_catalog FOR DELETE TO authenticated
  USING (public.is_support_catalog_editor());
