-- Manutenção de sistema: a solicitação de alteração volta o sistema para
-- "Alteração solicitada" (inclusive quando estava concluído) sem tirar o XP
-- já ganho. Quando a alteração é concluída, o responsável ganha uma fração
-- do XP de uma automação concluída (padrão 75%: 50 XP -> 37,5 XP).

-- 1) O servidor (função "solicitacoes", service_role) precisa poder mudar o
--    status ao registrar a alteração. O guard só deixa a equipe de TI mexer em
--    campos administrativos; a service_role é a própria função, então passa.
CREATE OR REPLACE FUNCTION public.guard_automation_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.can_manage_automation(NEW.id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.complexity IS DISTINCT FROM OLD.complexity
     OR NEW.xp_bonus_awarded IS DISTINCT FROM OLD.xp_bonus_awarded
     OR NEW.progress_percent IS DISTINCT FROM OLD.progress_percent
     OR NEW.request_kind IS DISTINCT FROM OLD.request_kind
     OR NEW.final_deadline IS DISTINCT FROM OLD.final_deadline
     OR NEW.estimated_deadline IS DISTINCT FROM OLD.estimated_deadline
     OR NEW.estimated_hours IS DISTINCT FROM OLD.estimated_hours
     OR NEW.risk_level IS DISTINCT FROM OLD.risk_level
     OR NEW.sector IS DISTINCT FROM OLD.sector
     OR NEW.requester_id IS DISTINCT FROM OLD.requester_id THEN
    RAISE EXCEPTION 'Somente a equipe de TI pode alterar campos administrativos desta automação';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_automation_admin_fields() FROM PUBLIC, anon, authenticated;

-- 2) XP: uma automação continua contando o XP da primeira conclusão, mesmo que
--    volte para "Alteração solicitada". Cada conclusão de alteração (status
--    change_requested -> completed) soma xp_per_automation * xp_change_pct / 100.
CREATE OR REPLACE FUNCTION public._gamification_stats_compute()
 RETURNS TABLE(user_id uuid, full_name text, avatar_url text, tasks_done integer, chamados_done integer, automations_done integer, seed_xp integer, ledger_xp integer, total_xp integer, medals_month integer, medals_year integer, medal_months jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH cfg AS (
  SELECT
    COALESCE(MAX(value) FILTER (WHERE key = 'xp_per_task'), 1) AS xp_task,
    COALESCE(MAX(value) FILTER (WHERE key = 'xp_per_automation'), 50) AS xp_auto,
    COALESCE(MAX(value) FILTER (WHERE key = 'medal_per_tasks'), 30) AS medal_tasks,
    COALESCE(MAX(value) FILTER (WHERE key = 'xp_change_pct'), 75) AS xp_change_pct
  FROM public.xp_settings
),
first_done AS (
  SELECT task_id, MIN(created_at) AS at FROM public.task_events
  WHERE event_type = 'completed' GROUP BY task_id
),
first_auto AS (
  SELECT automation_id, MIN(created_at) AS at FROM public.automation_events
  WHERE event_type = 'status_changed' AND metadata->>'new_status' = 'completed'
  GROUP BY automation_id
),
task_done AS (
  SELECT t.assigned_to AS uid, t.title, false AS is_sub, (SELECT xp_task FROM cfg)::numeric AS xp_pts,
         COALESCE(fd.at, t.updated_at) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' AS done_at
  FROM public.tasks t LEFT JOIN first_done fd ON fd.task_id = t.id
  WHERE t.status = 'done' AND t.assigned_to IS NOT NULL
  UNION ALL
  SELECT COALESCE(s.assigned_to, s.completed_by), s.title, true, 0::numeric,
         COALESCE(s.completed_at, s.created_at) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'
  FROM public.automation_subtasks s
  WHERE (s.status = 'done' OR COALESCE(s.completed, false))
    AND COALESCE(s.assigned_to, s.completed_by) IS NOT NULL
  UNION ALL
  SELECT ka.user_id, k.title, false,
         k.xp::numeric / NULLIF((SELECT COUNT(*) FROM public.kanban_task_assignees x WHERE x.task_id = k.id), 0),
         COALESCE(k.completed_at, k.updated_at) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'
  FROM public.kanban_tasks k
  JOIN public.kanban_task_assignees ka ON ka.task_id = k.id
  WHERE k.status = 'done'
),
-- Automação que já foi concluída alguma vez conta (mesmo que esteja em alteração).
auto_done AS (
  SELECT a.assigned_to AS uid,
         COALESCE(fa.at, a.completed_at, a.updated_at) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' AS done_at
  FROM public.automations a LEFT JOIN first_auto fa ON fa.automation_id = a.id
  WHERE a.assigned_to IS NOT NULL AND (a.status = 'completed' OR fa.at IS NOT NULL)
),
-- Conclusão de solicitação de alteração (veio de "Alteração solicitada").
change_done AS (
  SELECT a.assigned_to AS uid,
         e.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' AS done_at
  FROM public.automation_events e
  JOIN public.automations a ON a.id = e.automation_id
  WHERE e.event_type = 'status_changed'
    AND e.metadata->>'new_status' = 'completed'
    AND e.metadata->>'old_status' = 'change_requested'
    AND a.assigned_to IS NOT NULL
),
task_tot AS (
  SELECT uid,
         COUNT(*)::int AS total,
         COALESCE(SUM(xp_pts), 0) AS xp_pts,
         COUNT(*) FILTER (WHERE title ILIKE '[Chamado]%' AND NOT is_sub)::int AS chamados
  FROM task_done GROUP BY uid
),
auto_tot AS (SELECT uid, COUNT(*)::int AS total FROM auto_done GROUP BY uid),
change_tot AS (SELECT uid, COUNT(*)::int AS total FROM change_done GROUP BY uid),
months AS (
  SELECT uid, to_char(done_at, 'YYYY-MM') AS mkey, COUNT(*)::int AS tasks, 0::int AS autos, 0::int AS changes
  FROM task_done GROUP BY uid, 2
  UNION ALL
  SELECT uid, to_char(done_at, 'YYYY-MM'), 0, COUNT(*)::int, 0 FROM auto_done GROUP BY uid, 2
  UNION ALL
  SELECT uid, to_char(done_at, 'YYYY-MM'), 0, 0, COUNT(*)::int FROM change_done GROUP BY uid, 2
),
month_agg AS (
  SELECT uid, mkey, SUM(tasks)::int AS tasks, SUM(autos)::int AS autos, SUM(changes)::int AS changes,
         (SUM(tasks) / (SELECT medal_tasks FROM cfg))::int + SUM(autos)::int AS medals
  FROM months GROUP BY uid, mkey
),
ledger AS (SELECT l.user_id AS uid, SUM(l.amount)::int AS xp FROM public.xp_ledger l GROUP BY l.user_id)
SELECT
  p.id, p.full_name, p.avatar_url,
  COALESCE(tt.total, 0), COALESCE(tt.chamados, 0), COALESCE(at.total, 0),
  COALESCE(s.xp, 0), COALESCE(lg.xp, 0),
  (ROUND(COALESCE(tt.xp_pts, 0))
    + COALESCE(at.total, 0) * (SELECT xp_auto FROM cfg)
    + ROUND(COALESCE(ct.total, 0) * (SELECT xp_auto FROM cfg) * (SELECT xp_change_pct FROM cfg) / 100.0)
    + COALESCE(s.xp, 0) + COALESCE(lg.xp, 0))::int,
  COALESCE((SELECT ma.medals FROM month_agg ma WHERE ma.uid = p.id
               AND ma.mkey = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')), 0),
  COALESCE((SELECT SUM(ma.medals)::int FROM month_agg ma WHERE ma.uid = p.id
               AND left(ma.mkey, 4) = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY')), 0),
  COALESCE((SELECT jsonb_agg(jsonb_build_object('key', ma.mkey, 'tasks', ma.tasks, 'autos', ma.autos, 'changes', ma.changes, 'medals', ma.medals) ORDER BY ma.mkey DESC)
            FROM month_agg ma WHERE ma.uid = p.id), '[]'::jsonb)
FROM public.profiles p
LEFT JOIN task_tot tt ON tt.uid = p.id
LEFT JOIN auto_tot at ON at.uid = p.id
LEFT JOIN change_tot ct ON ct.uid = p.id
LEFT JOIN ledger lg ON lg.uid = p.id
LEFT JOIN public.xp_seeds s ON s.user_id = p.id;
$function$;
