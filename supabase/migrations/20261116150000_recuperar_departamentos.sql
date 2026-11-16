-- ============================================================================
-- Almoxarifado: recuperar só os departamentos de um lote do Container.
--
-- Copia apenas os departamentos do lote que ainda não existem (mesmo id ou
-- mesmo nome; o nome é único). Não exige almoxarifado vazio e não altera os
-- demais dados. Permissão: mesma lista de e-mails de recuperar_almoxarifado().
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recuperar_departamentos(_batch uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _snapshot jsonb;
  _restored int;
BEGIN
  IF _email NOT IN (
    'angel.kauan@orcoma.com.br',
    'sofia.nardes@orcoma.com.br',
    'welder@orcoma.com.br',
    'timaracas@orcoma.com.br'
  ) THEN
    RAISE EXCEPTION 'Sem permissão para recuperar departamentos';
  END IF;

  SELECT snapshot INTO _snapshot FROM public.inventory_container WHERE id = _batch;
  IF _snapshot IS NULL THEN
    RAISE EXCEPTION 'Lote não encontrado no Container';
  END IF;

  WITH ins AS (
    INSERT INTO public.inventory_departments
    SELECT s.*
    FROM jsonb_populate_recordset(NULL::public.inventory_departments, _snapshot->'inventory_departments') s
    WHERE NOT EXISTS (SELECT 1 FROM public.inventory_departments d WHERE d.id = s.id)
      AND NOT EXISTS (SELECT 1 FROM public.inventory_departments d WHERE lower(d.name) = lower(s.name))
    RETURNING 1
  )
  SELECT count(*) INTO _restored FROM ins;

  RETURN jsonb_build_object('id', _batch, 'restaurados', _restored);
END;
$function$;

REVOKE ALL ON FUNCTION public.recuperar_departamentos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recuperar_departamentos(uuid) TO authenticated;
