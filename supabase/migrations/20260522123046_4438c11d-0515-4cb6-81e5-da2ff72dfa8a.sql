CREATE OR REPLACE FUNCTION public.get_ti_assignable_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(DISTINCT user_id), '{}')
  FROM public.user_roles
  WHERE role IN ('member','dev','lider')
    AND user_id NOT IN (
      SELECT user_id FROM public.user_roles WHERE role IN ('admin','gestor','suporte')
    );
$$;

CREATE OR REPLACE FUNCTION public.get_social_assignable_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(DISTINCT user_id), '{}')
  FROM public.user_social_roles
  WHERE role = 'social_media';
$$;