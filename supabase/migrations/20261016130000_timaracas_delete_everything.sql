-- timaracas@orcoma.com.br pode excluir qualquer registro de qualquer tabela do schema public.
-- Policies permissivas são somadas (OR) às já existentes, então nada é restringido para os demais.

CREATE OR REPLACE FUNCTION public.is_super_deleter()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'timaracas@orcoma.com.br';
$function$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "super_deleter_delete" ON public.%I', r.tbl);
    EXECUTE format(
      'CREATE POLICY "super_deleter_delete" ON public.%I FOR DELETE TO authenticated USING (public.is_super_deleter())',
      r.tbl
    );
  END LOOP;
END $$;
