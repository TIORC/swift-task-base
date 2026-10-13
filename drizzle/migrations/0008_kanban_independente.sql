CREATE TABLE public.kanban_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'backlog',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  assigned_to uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kanban_tasks_status_idx ON public.kanban_tasks(status);
CREATE INDEX kanban_tasks_assigned_idx ON public.kanban_tasks(assigned_to);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_tasks TO authenticated;
GRANT ALL ON public.kanban_tasks TO service_role;
ALTER TABLE public.kanban_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kanban view" ON public.kanban_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "kanban insert" ON public.kanban_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by AND NOT (public.has_role(auth.uid(),'gestor') AND NOT public.has_role(auth.uid(),'admin')));
CREATE POLICY "kanban update" ON public.kanban_tasks FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to OR assigned_to IS NULL OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'lider'))
  WITH CHECK (auth.uid() = created_by OR auth.uid() = assigned_to OR assigned_to IS NULL OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'lider') OR true);
CREATE POLICY "kanban delete" ON public.kanban_tasks FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.kanban_tasks_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'done' AND NEW.completed_at IS NULL THEN NEW.completed_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER kanban_tasks_touch BEFORE INSERT OR UPDATE ON public.kanban_tasks FOR EACH ROW EXECUTE FUNCTION public.kanban_tasks_touch();

CREATE TABLE public.kanban_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kanban_task_comments_task_idx ON public.kanban_task_comments(task_id);
GRANT SELECT, INSERT, DELETE ON public.kanban_task_comments TO authenticated;
GRANT ALL ON public.kanban_task_comments TO service_role;
ALTER TABLE public.kanban_task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kc view" ON public.kanban_task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "kc insert" ON public.kanban_task_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kc delete" ON public.kanban_task_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public._gamification_stats_compute()
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
  SELECT t.assigned_to AS uid, t.title, false AS is_sub,
         COALESCE(fd.at, t.updated_at) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' AS done_at
  FROM public.tasks t LEFT JOIN first_done fd ON fd.task_id = t.id
  WHERE t.status = 'done' AND t.assigned_to IS NOT NULL
  UNION ALL
  SELECT COALESCE(s.assigned_to, s.completed_by), s.title, true,
         COALESCE(s.completed_at, s.created_at) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'
  FROM public.automation_subtasks s
  WHERE (s.status = 'done' OR COALESCE(s.completed, false))
    AND COALESCE(s.assigned_to, s.completed_by) IS NOT NULL
  UNION ALL
  SELECT k.assigned_to, k.title, false,
         COALESCE(k.completed_at, k.updated_at) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'
  FROM public.kanban_tasks k
  WHERE k.status = 'done' AND k.assigned_to IS NOT NULL
),
auto_done AS (
  SELECT a.assigned_to AS uid,
         COALESCE(fa.at, a.completed_at, a.updated_at) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' AS done_at
  FROM public.automations a LEFT JOIN first_auto fa ON fa.automation_id = a.id
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