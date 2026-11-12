-- ============================================================================
-- Hipocampo: Cofre compartilhado
--
-- Acesso restrito a: Angel, Gabriel, Sofia e Welder.
-- A palavra-chave NUNCA fica no código: é guardada como hash (crypt/bf) na
-- tabela hippocampus_vault_config. As tabelas não têm policies, então ninguém
-- lê ou grava direto; tudo passa pelas funções abaixo, e cada chamada exige a
-- palavra-chave (ela não é persistida no navegador).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Hash da palavra-chave (linha única)
CREATE TABLE IF NOT EXISTS public.hippocampus_vault_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  key_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Itens do cofre (compartilhados entre os quatro)
CREATE TABLE IF NOT EXISTS public.hippocampus_vault_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  content text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hippocampus_vault_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hippocampus_vault_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.hippocampus_vault_config FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.hippocampus_vault_items FROM PUBLIC, anon, authenticated;

-- Garante que só os quatro passam
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
    'welder@orcoma.com.br'
  ) THEN
    RAISE EXCEPTION 'Sem permissão para acessar o cofre';
  END IF;
END;
$function$;

-- Confere a palavra-chave (exige membro + palavra-chave já definida)
CREATE OR REPLACE FUNCTION public.hippocampus_vault_verify(p_keyword text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.hippocampus_vault_check_member();

  IF NOT EXISTS (SELECT 1 FROM public.hippocampus_vault_config) THEN
    RAISE EXCEPTION 'O cofre ainda não tem palavra-chave definida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.hippocampus_vault_config
    WHERE key_hash = crypt(coalesce(p_keyword, ''), key_hash)
  ) THEN
    RAISE EXCEPTION 'Palavra-chave incorreta';
  END IF;
END;
$function$;

-- Informa se o cofre já tem palavra-chave definida
CREATE OR REPLACE FUNCTION public.hippocampus_vault_status()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.hippocampus_vault_check_member();
  RETURN EXISTS (SELECT 1 FROM public.hippocampus_vault_config);
END;
$function$;

-- Define a palavra-chave pela primeira vez (depois disso não é alterada por aqui)
CREATE OR REPLACE FUNCTION public.hippocampus_vault_set_keyword(p_keyword text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.hippocampus_vault_check_member();

  IF p_keyword IS NULL OR length(trim(p_keyword)) < 4 THEN
    RAISE EXCEPTION 'A palavra-chave precisa ter pelo menos 4 caracteres';
  END IF;

  IF EXISTS (SELECT 1 FROM public.hippocampus_vault_config) THEN
    RAISE EXCEPTION 'O cofre já tem palavra-chave definida';
  END IF;

  INSERT INTO public.hippocampus_vault_config (id, key_hash)
  VALUES (true, crypt(p_keyword, gen_salt('bf')));
END;
$function$;

-- Lista os itens (exige palavra-chave)
CREATE OR REPLACE FUNCTION public.hippocampus_vault_list(p_keyword text)
RETURNS SETOF public.hippocampus_vault_items
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.hippocampus_vault_verify(p_keyword);
  RETURN QUERY
    SELECT * FROM public.hippocampus_vault_items ORDER BY updated_at DESC;
END;
$function$;

-- Adiciona um item (exige palavra-chave)
CREATE OR REPLACE FUNCTION public.hippocampus_vault_add(p_keyword text, p_title text, p_content text)
RETURNS public.hippocampus_vault_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _row public.hippocampus_vault_items;
BEGIN
  PERFORM public.hippocampus_vault_verify(p_keyword);

  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'O conteúdo não pode ficar vazio';
  END IF;

  INSERT INTO public.hippocampus_vault_items (title, content, created_by)
  VALUES (nullif(trim(coalesce(p_title, '')), ''), p_content, auth.uid())
  RETURNING * INTO _row;

  RETURN _row;
END;
$function$;

-- Remove um item (exige palavra-chave)
CREATE OR REPLACE FUNCTION public.hippocampus_vault_delete(p_keyword text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.hippocampus_vault_verify(p_keyword);
  DELETE FROM public.hippocampus_vault_items WHERE id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.hippocampus_vault_check_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hippocampus_vault_verify(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hippocampus_vault_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hippocampus_vault_set_keyword(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hippocampus_vault_list(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hippocampus_vault_add(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hippocampus_vault_delete(text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.hippocampus_vault_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hippocampus_vault_set_keyword(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hippocampus_vault_list(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hippocampus_vault_add(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hippocampus_vault_delete(text, uuid) TO authenticated;
-- hippocampus_vault_check_member e hippocampus_vault_verify são auxiliares: sem GRANT direto.
