-- Várias pessoas responsáveis por uma automação (igual ao Kanban), restritas a
-- Welder e Gabriel. Quem convida, remove e define o XP é o líder.
--
-- XP por responsável: cada pessoa tem o seu próprio valor (1 a 50, padrão 50),
-- que recebe ao concluir a automação. A alteração concluída vale
-- xp_change_pct% desse XP (padrão 75%).
--
-- Depende de 20261028120000 (xp_change_pct e status change_requested).

-- 0) Limpeza de uma versão anterior desta migração (XP por automação, que foi trocado por XP por responsável).
DROP TRIGGER IF EXISTS trg_guard_automation_xp ON public.automations;
DROP FUNCTION IF EXISTS public.guard_automation_xp();
ALTER TABLE public.automations DROP COLUMN IF EXISTS xp;
DROP FUNCTION IF EXISTS public.automation_set_assignees(uuid, uuid[]);

-- 1) Responsáveis e XP de cada um
CREATE TABLE IF NOT EXISTS public.automation_assignees (
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (automation_id, user_id)
);
ALTER TABLE public.automation_assignees
  ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 50;

DO $$ BEGIN
  ALTER TABLE public.automation_assignees
    ADD CONSTRAINT automation_assignees_xp_range CHECK (xp BETWEEN 1 AND 50);
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS automation_assignees_user_idx ON public.automation_assignees(user_id);

ALTER TABLE public.automation_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_assignees view" ON public.automation_assignees;
CREATE POLICY "automation_assignees view" ON public.automation_assignees
  FOR SELECT TO authenticated USING (true);
-- Sem política de INSERT/UPDATE/DELETE: a lista só muda pela função automation_set_assignees.

-- Dados atuais: quem estava em assigned_to vira o primeiro responsável, com XP 50.
INSERT INTO public.automation_assignees (automation_id, user_id, xp)
SELECT id, assigned_to, 50 FROM public.automations WHERE assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;

-- 2) Teste de líder: o papel 'lider' do Welder.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'lider'::app_role FROM auth.users u
WHERE u.email = 'welder@orcoma.com.br'
ON CONFLICT DO NOTHING;

-- 3) Líder também atualiza automações (responsável e demais campos).
DROP POLICY IF EXISTS "Lider updates automations" ON public.automations;
CREATE POLICY "Lider updates automations" ON public.automations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'lider'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'lider'::app_role));

-- 4) Guard de campos administrativos: o líder também pode mexer no responsável.
CREATE OR REPLACE FUNCTION public.guard_automation_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'lider'::app_role) THEN
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

-- 5) Define responsáveis e o XP de cada um (só líder ou admin). Só Welder e Gabriel.
--    _user_ids e _xp andam juntos: _xp[i] é o XP de _user_ids[i].
CREATE OR REPLACE FUNCTION public.automation_set_assignees(_automation_id uuid, _user_ids uuid[], _xp integer[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _ids uuid[] := COALESCE(_user_ids, ARRAY[]::uuid[]);
  _values integer[] := COALESCE(_xp, ARRAY[]::integer[]);
BEGIN
  IF NOT (public.has_role(auth.uid(), 'lider'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Somente o líder pode definir os responsáveis desta automação';
  END IF;

  IF COALESCE(array_length(_ids, 1), 0) <> COALESCE(array_length(_values, 1), 0) THEN
    RAISE EXCEPTION 'Cada responsável precisa de um XP';
  END IF;

  IF EXISTS (SELECT 1 FROM unnest(_values) AS v(xp) WHERE v.xp IS NULL OR v.xp < 1 OR v.xp > 50) THEN
    RAISE EXCEPTION 'O XP de cada responsável deve ficar entre 1 e 50';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(_ids) AS u(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = u.id
        AND lower(split_part(trim(p.full_name), ' ', 1)) IN ('welder', 'gabriel')
    )
  ) THEN
    RAISE EXCEPTION 'Responsável inválido: só Welder e Gabriel podem ser responsáveis por automações';
  END IF;

  DELETE FROM public.automation_assignees WHERE automation_id = _automation_id;
  INSERT INTO public.automation_assignees (automation_id, user_id, xp)
  SELECT _automation_id, t.id, t.xp
  FROM unnest(_ids, _values) AS t(id, xp)
  ON CONFLICT DO NOTHING;

  -- assigned_to continua preenchido (primeiro da lista) para as telas antigas.
  UPDATE public.automations
  SET assigned_to = CASE WHEN array_length(_ids, 1) IS NULL THEN NULL ELSE _ids[1] END
  WHERE id = _automation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.automation_set_assignees(uuid, uuid[], integer[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.automation_set_assignees(uuid, uuid[], integer[]) TO authenticated;

-- 6) XP: cada responsável recebe o XP definido para ele na automação.
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
-- Responsáveis de cada automação, com o XP de cada um. Sem lista, vale o assigned_to antigo com XP padrão.
auto_owner AS (
  SELECT aa.automation_id AS aid, aa.user_id AS uid, aa.xp::numeric AS xp FROM public.automation_assignees aa
  UNION ALL
  SELECT a.id, a.assigned_to, (SELECT xp_auto FROM cfg)::numeric FROM public.automations a
  WHERE a.assigned_to IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.automation_assignees x WHERE x.automation_id = a.id)
),
-- Automação já concluída alguma vez (continua contando se voltar para alteração).
auto_done AS (
  SELECT o.uid,
         COALESCE(fa.at, a.completed_at, a.updated_at) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' AS done_at,
         o.xp AS xp_share
  FROM public.automations a
  LEFT JOIN first_auto fa ON fa.automation_id = a.id
  JOIN auto_owner o ON o.aid = a.id
  WHERE a.status = 'completed' OR fa.at IS NOT NULL
),
-- Conclusão de solicitação de alteração: xp_change_pct% do XP de cada responsável.
change_done AS (
  SELECT o.uid,
         e.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' AS done_at,
         o.xp * (SELECT xp_change_pct FROM cfg) / 100 AS xp_share
  FROM public.automation_events e
  JOIN public.automations a ON a.id = e.automation_id
  JOIN auto_owner o ON o.aid = a.id
  WHERE e.event_type = 'status_changed'
    AND e.metadata->>'new_status' = 'completed'
    AND e.metadata->>'old_status' = 'change_requested'
),
task_tot AS (
  SELECT uid,
         COUNT(*)::int AS total,
         COALESCE(SUM(xp_pts), 0) AS xp_pts,
         COUNT(*) FILTER (WHERE title ILIKE '[Chamado]%' AND NOT is_sub)::int AS chamados
  FROM task_done GROUP BY uid
),
auto_tot AS (
  SELECT uid, COUNT(*)::int AS total, COALESCE(SUM(xp_share), 0) AS xp FROM auto_done GROUP BY uid
),
change_tot AS (
  SELECT uid, COALESCE(SUM(xp_share), 0) AS xp FROM change_done GROUP BY uid
),
months AS (
  SELECT uid, to_char(done_at, 'YYYY-MM') AS mkey, COUNT(*)::int AS tasks, 0::int AS autos, 0::int AS changes,
         COALESCE(SUM(xp_pts), 0) AS xp
  FROM task_done GROUP BY uid, 2
  UNION ALL
  SELECT uid, to_char(done_at, 'YYYY-MM'), 0, COUNT(*)::int, 0, COALESCE(SUM(xp_share), 0)
  FROM auto_done GROUP BY uid, 2
  UNION ALL
  SELECT uid, to_char(done_at, 'YYYY-MM'), 0, 0, COUNT(*)::int, COALESCE(SUM(xp_share), 0)
  FROM change_done GROUP BY uid, 2
),
month_agg AS (
  SELECT uid, mkey, SUM(tasks)::int AS tasks, SUM(autos)::int AS autos, SUM(changes)::int AS changes,
         SUM(xp) AS xp,
         (SUM(tasks) / (SELECT medal_tasks FROM cfg))::int + SUM(autos)::int AS medals
  FROM months GROUP BY uid, mkey
),
ledger AS (SELECT l.user_id AS uid, SUM(l.amount)::int AS xp FROM public.xp_ledger l GROUP BY l.user_id)
SELECT
  p.id, p.full_name, p.avatar_url,
  COALESCE(tt.total, 0), COALESCE(tt.chamados, 0), COALESCE(at.total, 0),
  COALESCE(s.xp, 0), COALESCE(lg.xp, 0),
  (ROUND(COALESCE(tt.xp_pts, 0))
    + ROUND(COALESCE(at.xp, 0))
    + ROUND(COALESCE(ct.xp, 0))
    + COALESCE(s.xp, 0) + COALESCE(lg.xp, 0))::int,
  COALESCE((SELECT ma.medals FROM month_agg ma WHERE ma.uid = p.id
               AND ma.mkey = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')), 0),
  COALESCE((SELECT SUM(ma.medals)::int FROM month_agg ma WHERE ma.uid = p.id
               AND left(ma.mkey, 4) = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY')), 0),
  COALESCE((SELECT jsonb_agg(jsonb_build_object('key', ma.mkey, 'tasks', ma.tasks, 'autos', ma.autos,
                                                'changes', ma.changes, 'xp', ROUND(ma.xp), 'medals', ma.medals)
                             ORDER BY ma.mkey DESC)
            FROM month_agg ma WHERE ma.uid = p.id), '[]'::jsonb)
FROM public.profiles p
LEFT JOIN task_tot tt ON tt.uid = p.id
LEFT JOIN auto_tot at ON at.uid = p.id
LEFT JOIN change_tot ct ON ct.uid = p.id
LEFT JOIN ledger lg ON lg.uid = p.id
LEFT JOIN public.xp_seeds s ON s.user_id = p.id;
$function$;
