-- ============================================================================
-- Hipocampo: alterar a palavra-chave do cofre
--
-- Só o TIMaracas (timaracas@orcoma.com.br) pode alterar a palavra-chave.
-- A verificação fica no banco, não só na interface. A função exige a
-- palavra-chave atual e grava a nova como hash (crypt/bf). Nenhuma senha
-- fica no código nem nesta migration: a nova palavra-chave é digitada no app.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hippocampus_vault_change_keyword(p_old text, p_new text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(coalesce(auth.jwt() ->> 'email', '')) <> 'timaracas@orcoma.com.br' THEN
    RAISE EXCEPTION 'Apenas o TIMaracas pode alterar a palavra-chave do cofre';
  END IF;

  -- Exige membro do cofre + palavra-chave atual correta
  PERFORM public.hippocampus_vault_verify(p_old);

  IF p_new IS NULL OR length(trim(p_new)) < 4 THEN
    RAISE EXCEPTION 'A nova palavra-chave precisa ter pelo menos 4 caracteres';
  END IF;

  IF p_new = p_old THEN
    RAISE EXCEPTION 'A nova palavra-chave precisa ser diferente da atual';
  END IF;

  UPDATE public.hippocampus_vault_config
  SET key_hash = extensions.crypt(p_new, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = true;
END;
$function$;

REVOKE ALL ON FUNCTION public.hippocampus_vault_change_keyword(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hippocampus_vault_change_keyword(text, text) TO authenticated;
