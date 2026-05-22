CREATE OR REPLACE FUNCTION public.get_ti_assignable_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT user_id), '{}')
  FROM public.user_roles
  WHERE role IN ('member','dev','lider');
$function$;