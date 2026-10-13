-- Várias etiquetas de responsável por tarefa no Kanban do TI.
-- kanban_tasks.assigned_to (um único responsável) é substituído pela tabela kanban_task_assignees.
-- Regra: sem nenhum responsável = a tarefa está aberta para todos (igual ao antigo "sem responsável").

CREATE TABLE public.kanban_task_assignees (
  task_id uuid NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE INDEX kanban_task_assignees_user_idx ON public.kanban_task_assignees(user_id);

GRANT SELECT, INSERT, DELETE ON public.kanban_task_assignees TO authenticated;
GRANT ALL ON public.kanban_task_assignees TO service_role;
ALTER TABLE public.kanban_task_assignees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kta_assignees view" ON public.kanban_task_assignees FOR SELECT TO authenticated USING (true);

-- Dados atuais: quem estava em assigned_to vira o primeiro (e único) responsável.
INSERT INTO public.kanban_task_assignees (task_id, user_id)
SELECT id, assigned_to FROM public.kanban_tasks WHERE assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;

-- Regra de edição única, usada por tarefa, anexos e checklist.
CREATE OR REPLACE FUNCTION public.kanban_can_edit(_task_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kanban_tasks t
    WHERE t.id = _task_id
      AND (
        t.created_by = auth.uid()
        OR NOT EXISTS (SELECT 1 FROM public.kanban_task_assignees a WHERE a.task_id = t.id)
        OR EXISTS (SELECT 1 FROM public.kanban_task_assignees a WHERE a.task_id = t.id AND a.user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'lider')
      )
  );
$$;

-- Políticas que dependiam de assigned_to
DROP POLICY "kanban update" ON public.kanban_tasks;
CREATE POLICY "kanban update" ON public.kanban_tasks FOR UPDATE TO authenticated
  USING (public.kanban_can_edit(id))
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY "kta insert" ON public.kanban_task_attachments;
DROP POLICY "kta update" ON public.kanban_task_attachments;
CREATE POLICY "kta insert" ON public.kanban_task_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.kanban_can_edit(task_id));
CREATE POLICY "kta update" ON public.kanban_task_attachments FOR UPDATE TO authenticated
  USING (public.kanban_can_edit(task_id))
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY "ktci insert" ON public.kanban_task_checklist_items;
DROP POLICY "ktci update" ON public.kanban_task_checklist_items;
DROP POLICY "ktci delete" ON public.kanban_task_checklist_items;
CREATE POLICY "ktci insert" ON public.kanban_task_checklist_items FOR INSERT TO authenticated
  WITH CHECK (public.kanban_can_edit(task_id));
CREATE POLICY "ktci update" ON public.kanban_task_checklist_items FOR UPDATE TO authenticated
  USING (public.kanban_can_edit(task_id))
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ktci delete" ON public.kanban_task_checklist_items FOR DELETE TO authenticated
  USING (public.kanban_can_edit(task_id));

-- Políticas da própria tabela de responsáveis: quem pode editar a tarefa altera a lista.
CREATE POLICY "kta_assignees insert" ON public.kanban_task_assignees FOR INSERT TO authenticated
  WITH CHECK (public.kanban_can_edit(task_id));
CREATE POLICY "kta_assignees delete" ON public.kanban_task_assignees FOR DELETE TO authenticated
  USING (public.kanban_can_edit(task_id));

-- XP do Kanban: cada responsável da tarefa concluída recebe o ponto (antes era só assigned_to).
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
  SELECT ka.user_id, k.title, false,
         COALESCE(k.completed_at, k.updated_at) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'
  FROM public.kanban_tasks k
  JOIN public.kanban_task_assignees ka ON ka.task_id = k.id
  WHERE k.status = 'done'
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

ALTER TABLE public.kanban_tasks DROP COLUMN assigned_to;
