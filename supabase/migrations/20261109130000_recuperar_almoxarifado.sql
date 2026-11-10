-- ============================================================================
-- Almoxarifado: recuperar um lote do Container
--
-- recuperar_almoxarifado(lote) copia de volta para as tabelas ativas os dados
-- guardados em um lote de inventory_container. O lote é mantido no Container.
-- Só roda se o almoxarifado estiver vazio (sem itens, patrimônios ou
-- movimentações), para não misturar dados novos com os antigos.
-- Permissão: mesma lista de e-mails de arquivar_almoxarifado().
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recuperar_almoxarifado(_batch uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _snapshot jsonb;
  _has_trigger boolean;
BEGIN
  IF _email NOT IN (
    'angel.kauan@orcoma.com.br',
    'sofia.nardes@orcoma.com.br',
    'welder@orcoma.com.br',
    'timaracas@orcoma.com.br'
  ) THEN
    RAISE EXCEPTION 'Sem permissão para recuperar o almoxarifado';
  END IF;

  SELECT snapshot INTO _snapshot FROM public.inventory_container WHERE id = _batch;
  IF _snapshot IS NULL THEN
    RAISE EXCEPTION 'Lote não encontrado no Container';
  END IF;

  IF EXISTS (SELECT 1 FROM public.inventory_items)
     OR EXISTS (SELECT 1 FROM public.inventory_assets)
     OR EXISTS (SELECT 1 FROM public.inventory_movements) THEN
    RAISE EXCEPTION 'O almoxarifado já tem dados. Limpe-o antes de recuperar um lote';
  END IF;

  INSERT INTO public.inventory_categories    SELECT * FROM jsonb_populate_recordset(NULL::public.inventory_categories, _snapshot->'inventory_categories');
  INSERT INTO public.inventory_locations     SELECT * FROM jsonb_populate_recordset(NULL::public.inventory_locations, _snapshot->'inventory_locations');
  INSERT INTO public.inventory_departments   SELECT * FROM jsonb_populate_recordset(NULL::public.inventory_departments, _snapshot->'inventory_departments');
  INSERT INTO public.inventory_collaborators SELECT * FROM jsonb_populate_recordset(NULL::public.inventory_collaborators, _snapshot->'inventory_collaborators');
  INSERT INTO public.inventory_items         SELECT * FROM jsonb_populate_recordset(NULL::public.inventory_items, _snapshot->'inventory_items');
  INSERT INTO public.inventory_assets        SELECT * FROM jsonb_populate_recordset(NULL::public.inventory_assets, _snapshot->'inventory_assets');
  INSERT INTO public.inventory_requests      SELECT * FROM jsonb_populate_recordset(NULL::public.inventory_requests, _snapshot->'inventory_requests');

  -- Movimentações voltam sem reaplicar o efeito no estoque: as quantidades já são as do lote.
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_apply_movement' AND tgrelid = 'public.inventory_movements'::regclass
  ) INTO _has_trigger;

  IF _has_trigger THEN
    ALTER TABLE public.inventory_movements DISABLE TRIGGER trg_apply_movement;
    INSERT INTO public.inventory_movements SELECT * FROM jsonb_populate_recordset(NULL::public.inventory_movements, _snapshot->'inventory_movements');
    ALTER TABLE public.inventory_movements ENABLE TRIGGER trg_apply_movement;
  ELSE
    INSERT INTO public.inventory_movements SELECT * FROM jsonb_populate_recordset(NULL::public.inventory_movements, _snapshot->'inventory_movements');
  END IF;

  RETURN jsonb_build_object('id', _batch);
END;
$function$;

REVOKE ALL ON FUNCTION public.recuperar_almoxarifado(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recuperar_almoxarifado(uuid) TO authenticated;
