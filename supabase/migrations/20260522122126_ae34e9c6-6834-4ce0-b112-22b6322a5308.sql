
CREATE OR REPLACE FUNCTION public.get_ti_assignable_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(user_id), '{}')
  FROM (
    SELECT user_id
    FROM public.user_roles
    GROUP BY user_id
    HAVING NOT (count(*) = 1 AND bool_or(role = 'suporte'))
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.get_social_assignable_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT us.user_id), '{}')
  FROM public.user_systems us
  WHERE us.system = 'social'
    AND us.enabled = true
    AND NOT EXISTS (
      SELECT 1 FROM public.user_social_roles usr
      WHERE usr.user_id = us.user_id AND usr.role = 'cliente'
    );
$$;
