CREATE OR REPLACE FUNCTION public.gamification_stats()
 RETURNS TABLE(user_id uuid, full_name text, avatar_url text, tasks_done integer, chamados_done integer, automations_done integer, seed_xp integer, ledger_xp integer, total_xp integer, medals_month integer, medals_year integer, medal_months jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH cfg AS (
  SELECT
    COALESCE(MAX(value) FILTER (WHERE key = 'xp_per_task'), 1) AS xp_task,
    COALESCE(MAX(value) FILTER (WHERE key = 'xp_per_automation'), 50) AS xp_auto,
    COALESCE(MAX(value) FILTER (WHERE key = 'medal_per_tasks'), 30) AS medal_tasks
  FROM public.xp_settings
),
task_done AS (
  SELECT t.assigned_to AS uid, t.title, false AS is_sub,
         COALESCE(
           (SELECT MIN(e.created_at) FROM public.task_events e
             WHERE e.task_id = t.id AND e.event_type = 'completed'),
           t.updated_at
         ) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' AS done_at
  FROM public.tasks t
  WHERE t.status = 'done' AND t.assigned_to IS NOT NULL
  UNION ALL
  SELECT COALESCE(s.assigned_to, s.completed_by), s.title, true,
         COALESCE(s.completed_at, s.created_at) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'
  FROM public.automation_subtasks s
  WHERE (s.status = 'done' OR COALESCE(s.completed, false))
    AND COALESCE(s.assigned_to, s.completed_by) IS NOT NULL
),
auto_done AS (
  SELECT a.assigned_to AS uid,
         COALESCE(
           (SELECT MIN(e.created_at) FROM public.automation_events e
             WHERE e.automation_id = a.id AND e.event_type = 'status_changed'
               AND e.metadata->>'new_status' = 'completed'),
           a.completed_at, a.updated_at
         ) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' AS done_at
  FROM public.automations a
  WHERE a.status = 'completed' AND a.assigned_to IS NOT NULL
),
task_tot AS (
  SELECT uid,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE NOT is_sub)::int AS xp_count,
         COUNT(*) FILTER (WHERE title ILIKE '[Chamado]%' AND NOT is_sub)::int AS chamados
  FROM task_done GROUP BY uid
),
auto_tot AS (SELECT uid, COUNT(*)::int AS total FROM auto_done GROUP BY uid),
months AS (
  SELECT uid, to_char(done_at, 'YYYY-MM') AS mkey, COUNT(*)::int AS tasks, 0::int AS autos
  FROM task_done GROUP BY uid, 2
  UNION ALL
  SELECT uid, to_char(done_at, 'YYYY-MM'), 0, COUNT(*)::int FROM auto_done GROUP BY uid, 2
),
month_agg AS (
  SELECT uid, mkey, SUM(tasks)::int AS tasks, SUM(autos)::int AS autos,
         (SUM(tasks) / (SELECT medal_tasks FROM cfg))::int + SUM(autos)::int AS medals
  FROM months GROUP BY uid, mkey
),
ledger AS (SELECT l.user_id AS uid, SUM(l.amount)::int AS xp FROM public.xp_ledger l GROUP BY l.user_id)
SELECT
  p.id, p.full_name, p.avatar_url,
  COALESCE(tt.total, 0), COALESCE(tt.chamados, 0), COALESCE(at.total, 0),
  COALESCE(s.xp, 0), COALESCE(lg.xp, 0),
  (COALESCE(tt.xp_count, 0) * (SELECT xp_task FROM cfg)
    + COALESCE(at.total, 0) * (SELECT xp_auto FROM cfg)
    + COALESCE(s.xp, 0) + COALESCE(lg.xp, 0))::int,
  COALESCE((SELECT ma.medals FROM month_agg ma WHERE ma.uid = p.id
               AND ma.mkey = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')), 0),
  COALESCE((SELECT SUM(ma.medals)::int FROM month_agg ma WHERE ma.uid = p.id
               AND left(ma.mkey, 4) = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY')), 0),
  COALESCE((SELECT jsonb_agg(jsonb_build_object('key', ma.mkey, 'tasks', ma.tasks, 'autos', ma.autos, 'medals', ma.medals) ORDER BY ma.mkey DESC)
            FROM month_agg ma WHERE ma.uid = p.id), '[]'::jsonb)
FROM public.profiles p
LEFT JOIN task_tot tt ON tt.uid = p.id
LEFT JOIN auto_tot at ON at.uid = p.id
LEFT JOIN ledger lg ON lg.uid = p.id
LEFT JOIN public.xp_seeds s ON s.user_id = p.id;
$function$;