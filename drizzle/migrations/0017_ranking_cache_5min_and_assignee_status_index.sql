CREATE OR REPLACE FUNCTION public.gamification_stats()
 RETURNS TABLE(user_id uuid, full_name text, avatar_url text, tasks_done integer, chamados_done integer, automations_done integer, seed_xp integer, ledger_xp integer, total_xp integer, medals_month integer, medals_year integer, medal_months jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c jsonb;
BEGIN
  SELECT g.data INTO c FROM public.gamification_stats_cache g
   WHERE g.id = 1 AND g.computed_at > now() - interval '5 minutes';
  IF c IS NULL THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) INTO c FROM public._gamification_stats_compute() x;
    INSERT INTO public.gamification_stats_cache (id, computed_at, data) VALUES (1, now(), c)
      ON CONFLICT (id) DO UPDATE SET computed_at = EXCLUDED.computed_at, data = EXCLUDED.data;
  END IF;
  RETURN QUERY SELECT * FROM jsonb_to_recordset(c) AS r(user_id uuid, full_name text, avatar_url text, tasks_done integer, chamados_done integer, automations_done integer, seed_xp integer, ledger_xp integer, total_xp integer, medals_month integer, medals_year integer, medal_months jsonb);
END $function$;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status_updated ON public.tasks (assigned_to, status, updated_at DESC);