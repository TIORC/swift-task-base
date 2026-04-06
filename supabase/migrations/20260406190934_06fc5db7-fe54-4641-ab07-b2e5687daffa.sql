CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(user_id), '{}')
  FROM public.user_roles
  WHERE role = 'admin'
$$;