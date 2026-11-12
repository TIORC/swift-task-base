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
  VALUES (true, extensions.crypt(p_keyword, extensions.gen_salt('bf')));
END;
$function$;
CREATE OR REPLACE FUNCTION public.hippocampus_vault_verify(p_keyword text)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.hippocampus_vault_check_member();
  IF NOT EXISTS (SELECT 1 FROM public.hippocampus_vault_config) THEN
    RAISE EXCEPTION 'O cofre ainda não tem palavra-chave definida';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.hippocampus_vault_config
    WHERE key_hash = extensions.crypt(coalesce(p_keyword, ''), key_hash)
  ) THEN
    RAISE EXCEPTION 'Palavra-chave incorreta';
  END IF;
END;
$function$;