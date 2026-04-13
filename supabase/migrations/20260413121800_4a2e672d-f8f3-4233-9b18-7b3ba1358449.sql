CREATE OR REPLACE FUNCTION public.get_gestor_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(user_id), '{}')
  FROM public.user_roles
  WHERE role = 'gestor'
$$;