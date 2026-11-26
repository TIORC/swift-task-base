-- ============================================================================
-- Hipocampo: TIMaracas passa a ser membro do cofre (vê e abre o cofre).
-- Recria a checagem de membro com a lista completa. As permissões da função
-- são mantidas pelo CREATE OR REPLACE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hippocampus_vault_check_member()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(coalesce(auth.jwt() ->> 'email', '')) NOT IN (
    'angel.kauan@orcoma.com.br',
    'gabriel.anacleto@orcoma.com.br',
    'sofia.nardes@orcoma.com.br',
    'welder@orcoma.com.br',
    'timaracas@orcoma.com.br'
  ) THEN
    RAISE EXCEPTION 'Sem permissão para acessar o cofre';
  END IF;
END;
$function$;
