-- ============================================================================
-- Almoxarifado: aba ADM TI (planilha no "Modo Excel").
--
-- As linhas são gravadas de uma vez pela função salvar_adm_ti(), que atualiza
-- as existentes (pelo id), insere as novas e remove as que saíram da planilha.
-- Leitura: qualquer usuário autenticado. Gravação: quem pode escrever no
-- almoxarifado (has_ti_write).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_adm_ti (
  id uuid PRIMARY KEY,
  ativo text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT '',
  patrimonio text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  departamento text NOT NULL DEFAULT '',
  colaborador text NOT NULL DEFAULT '',
  historico text NOT NULL DEFAULT '',
  observacao text NOT NULL DEFAULT '',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.inventory_adm_ti TO authenticated;
ALTER TABLE public.inventory_adm_ti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adm_ti_read" ON public.inventory_adm_ti;
CREATE POLICY "adm_ti_read" ON public.inventory_adm_ti
  FOR SELECT TO authenticated USING (true);

-- Sem policies de escrita: a gravação só acontece pela função abaixo.

CREATE OR REPLACE FUNCTION public.salvar_adm_ti(_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _count integer;
BEGIN
  IF NOT public.has_ti_write(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para gravar a aba ADM TI';
  END IF;

  DELETE FROM public.inventory_adm_ti
  WHERE id NOT IN (SELECT (r->>'id')::uuid FROM jsonb_array_elements(coalesce(_rows, '[]'::jsonb)) r);

  INSERT INTO public.inventory_adm_ti
    (id, ativo, categoria, patrimonio, status, descricao, departamento, colaborador, historico, observacao, created_by)
  SELECT
    (r->>'id')::uuid, coalesce(r->>'ativo', ''), coalesce(r->>'categoria', ''), coalesce(r->>'patrimonio', ''),
    coalesce(r->>'status', ''), coalesce(r->>'descricao', ''), coalesce(r->>'departamento', ''),
    coalesce(r->>'colaborador', ''), coalesce(r->>'historico', ''), coalesce(r->>'observacao', ''), auth.uid()
  FROM jsonb_array_elements(coalesce(_rows, '[]'::jsonb)) r
  ON CONFLICT (id) DO UPDATE SET
    ativo = EXCLUDED.ativo, categoria = EXCLUDED.categoria, patrimonio = EXCLUDED.patrimonio,
    status = EXCLUDED.status, descricao = EXCLUDED.descricao, departamento = EXCLUDED.departamento,
    colaborador = EXCLUDED.colaborador, historico = EXCLUDED.historico, observacao = EXCLUDED.observacao,
    updated_at = now();

  SELECT count(*) INTO _count FROM public.inventory_adm_ti;
  RETURN _count;
END;
$function$;

REVOKE ALL ON FUNCTION public.salvar_adm_ti(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salvar_adm_ti(jsonb) TO authenticated;
