-- ============================================================
-- 1. XP configuration + seeds + ledger (single source of truth)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.xp_settings (
  key text PRIMARY KEY,
  value integer NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.xp_settings TO authenticated;
GRANT ALL ON public.xp_settings TO service_role;
ALTER TABLE public.xp_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_settings readable" ON public.xp_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "xp_settings admin write" ON public.xp_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

INSERT INTO public.xp_settings (key, value, description) VALUES
  ('xp_per_task', 1, 'XP por tarefa/chamado concluído'),
  ('xp_per_automation', 50, 'XP por automação concluída'),
  ('xp_per_automation_task', 1, 'XP por tarefa interna de automação concluída'),
  ('medal_per_tasks', 30, 'Tarefas concluídas por medalha'),
  ('bonus_low', 1, 'Bônus de conclusão — Simples'),
  ('bonus_medium', 3, 'Bônus de conclusão — Média'),
  ('bonus_high', 5, 'Bônus de conclusão — Complexa'),
  ('bonus_strategic', 8, 'Bônus de conclusão — Estratégica')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.xp_seeds (
  user_id uuid PRIMARY KEY,
  xp integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.xp_seeds TO authenticated;
GRANT ALL ON public.xp_seeds TO service_role;
ALTER TABLE public.xp_seeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_seeds readable" ON public.xp_seeds FOR SELECT TO authenticated USING (true);
CREATE POLICY "xp_seeds admin write" ON public.xp_seeds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.xp_seeds (user_id, xp, note) VALUES
  ('f7c4a624-0f8f-432d-b7c0-047b36817670', 3600, '6 anos de TI'),
  ('242acd59-00fb-478f-8d78-b25219798aa6', 1750, '2 anos de TI')
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.xp_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL,
  ref_id uuid,
  amount integer NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS xp_ledger_unique_award
  ON public.xp_ledger (source, ref_id) WHERE amount > 0 AND ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS xp_ledger_user_idx ON public.xp_ledger (user_id, created_at DESC);
GRANT SELECT ON public.xp_ledger TO authenticated;
GRANT ALL ON public.xp_ledger TO service_role;
ALTER TABLE public.xp_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_ledger readable" ON public.xp_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "xp_ledger admin adjust" ON public.xp_ledger FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
  );

-- ============================================================
-- 2. Automation requests: requester, attachments, richer tasks
-- ============================================================
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS requester_id uuid;
ALTER TABLE public.automations ADD COLUMN IF NOT EXISTS xp_bonus_awarded integer;

ALTER TABLE public.automation_subtasks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.automation_subtasks ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo';
ALTER TABLE public.automation_subtasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.automation_subtasks ADD COLUMN IF NOT EXISTS completed_by uuid;

CREATE TABLE IF NOT EXISTS public.automation_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_attachments_automation_idx ON public.automation_attachments (automation_id);
GRANT SELECT, INSERT, DELETE ON public.automation_attachments TO authenticated;
GRANT ALL ON public.automation_attachments TO service_role;
ALTER TABLE public.automation_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Access helpers (tenant by sector)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_global_automation_access(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(_user, 'admin'::app_role)
      OR public.has_role(_user, 'gestor'::app_role)
      OR public.has_role(_user, 'lider'::app_role)
      OR public.has_role(_user, 'dev'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.can_view_automation(_automation_id uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.automations a
    WHERE a.id = _automation_id
      AND (
        public.has_global_automation_access(_user)
        OR a.created_by = _user
        OR a.assigned_to = _user
        OR a.requester_id = _user
        OR public.has_sector_access(_user, a.sector)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_automation(_automation_id uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_global_automation_access(_user)
      OR EXISTS (
        SELECT 1 FROM public.automations a
        WHERE a.id = _automation_id AND a.assigned_to = _user
      );
$$;

CREATE POLICY "View attachments of accessible automations" ON public.automation_attachments
  FOR SELECT TO authenticated USING (public.can_view_automation(automation_id, auth.uid()));
CREATE POLICY "Upload attachments to accessible automations" ON public.automation_attachments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_automation(automation_id, auth.uid()));
CREATE POLICY "Delete own attachments" ON public.automation_attachments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_automation(automation_id, auth.uid()));

-- Tighten child tables: reads follow the parent automation
DROP POLICY IF EXISTS "Auth read automation_comments" ON public.automation_comments;
CREATE POLICY "Read comments of accessible automations" ON public.automation_comments
  FOR SELECT TO authenticated USING (public.can_view_automation(automation_id, auth.uid()));
DROP POLICY IF EXISTS "Users insert own automation_comments" ON public.automation_comments;
CREATE POLICY "Insert comments on accessible automations" ON public.automation_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_automation(automation_id, auth.uid()));

DROP POLICY IF EXISTS "Auth read automation_events" ON public.automation_events;
CREATE POLICY "Read events of accessible automations" ON public.automation_events
  FOR SELECT TO authenticated USING (public.can_view_automation(automation_id, auth.uid()));
DROP POLICY IF EXISTS "Auth insert automation_events" ON public.automation_events;
CREATE POLICY "Insert events on accessible automations" ON public.automation_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_view_automation(automation_id, auth.uid()));

DROP POLICY IF EXISTS "Auth read automation_subtasks" ON public.automation_subtasks;
CREATE POLICY "Read subtasks of accessible automations" ON public.automation_subtasks
  FOR SELECT TO authenticated USING (public.can_view_automation(automation_id, auth.uid()));

DROP POLICY IF EXISTS "Auth read automation_blockers" ON public.automation_blockers;
CREATE POLICY "Read blockers of accessible automations" ON public.automation_blockers
  FOR SELECT TO authenticated USING (public.can_view_automation(automation_id, auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view all automation time logs" ON public.automation_time_logs;
CREATE POLICY "Read time logs of accessible automations" ON public.automation_time_logs
  FOR SELECT TO authenticated USING (public.can_view_automation(automation_id, auth.uid()));

-- ============================================================
-- 4. XP triggers (idempotent awards)
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_subtask_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _amount integer;
  _target uuid;
BEGIN
  IF COALESCE(NEW.completed, false) AND NOT COALESCE(OLD.completed, false) THEN
    _target := COALESCE(NEW.assigned_to, NEW.completed_by, auth.uid());
    IF _target IS NULL THEN RETURN NEW; END IF;
    SELECT value INTO _amount FROM public.xp_settings WHERE key = 'xp_per_automation_task';
    INSERT INTO public.xp_ledger (user_id, source, ref_id, amount, reason, created_by)
    VALUES (_target, 'automation_subtask', NEW.id, COALESCE(_amount, 1),
            'Tarefa de automação concluída: ' || NEW.title, auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_subtask_xp ON public.automation_subtasks;
CREATE TRIGGER trg_award_subtask_xp
AFTER UPDATE ON public.automation_subtasks
FOR EACH ROW EXECUTE FUNCTION public.award_subtask_xp();

CREATE OR REPLACE FUNCTION public.revoke_subtask_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _awarded record;
BEGIN
  SELECT * INTO _awarded FROM public.xp_ledger
  WHERE source = 'automation_subtask' AND ref_id = OLD.id AND amount > 0 LIMIT 1;
  IF FOUND THEN
    INSERT INTO public.xp_ledger (user_id, source, ref_id, amount, reason, created_by)
    VALUES (_awarded.user_id, 'automation_subtask_revoked', NULL, -_awarded.amount,
            'Tarefa de automação removida: ' || OLD.title, auth.uid());
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_subtask_xp ON public.automation_subtasks;
CREATE TRIGGER trg_revoke_subtask_xp
BEFORE DELETE ON public.automation_subtasks
FOR EACH ROW EXECUTE FUNCTION public.revoke_subtask_xp();

CREATE OR REPLACE FUNCTION public.award_automation_bonus()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _amount integer;
  _key text;
BEGIN
  IF NEW.status = 'completed' AND COALESCE(OLD.status, '') <> 'completed' AND NEW.assigned_to IS NOT NULL THEN
    _key := CASE COALESCE(NEW.complexity, 'medium')
      WHEN 'low' THEN 'bonus_low'
      WHEN 'medium' THEN 'bonus_medium'
      WHEN 'high' THEN 'bonus_high'
      WHEN 'strategic' THEN 'bonus_strategic'
      ELSE 'bonus_medium' END;
    SELECT value INTO _amount FROM public.xp_settings WHERE key = _key;
    IF COALESCE(_amount, 0) > 0 THEN
      INSERT INTO public.xp_ledger (user_id, source, ref_id, amount, reason, created_by)
      VALUES (NEW.assigned_to, 'automation_bonus', NEW.id, _amount,
              'Bônus de conclusão (' || COALESCE(NEW.complexity, 'medium') || '): ' || NEW.title, auth.uid())
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_automation_bonus ON public.automations;
CREATE TRIGGER trg_award_automation_bonus
AFTER UPDATE ON public.automations
FOR EACH ROW EXECUTE FUNCTION public.award_automation_bonus();

-- ============================================================
-- 5. Single gamification source of truth
-- ============================================================
CREATE OR REPLACE FUNCTION public.gamification_stats()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  tasks_done integer,
  chamados_done integer,
  automations_done integer,
  seed_xp integer,
  ledger_xp integer,
  total_xp integer,
  medals_month integer,
  medals_year integer,
  medal_months jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
WITH cfg AS (
  SELECT
    COALESCE(MAX(value) FILTER (WHERE key = 'xp_per_task'), 1) AS xp_task,
    COALESCE(MAX(value) FILTER (WHERE key = 'xp_per_automation'), 50) AS xp_auto,
    COALESCE(MAX(value) FILTER (WHERE key = 'medal_per_tasks'), 30) AS medal_tasks
  FROM public.xp_settings
),
task_done AS (
  SELECT t.assigned_to AS uid,
         t.title,
         COALESCE(
           (SELECT MIN(e.created_at) FROM public.task_events e
             WHERE e.task_id = t.id AND e.event_type = 'completed'),
           t.updated_at
         ) AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' AS done_at
  FROM public.tasks t
  WHERE t.status = 'done' AND t.assigned_to IS NOT NULL
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
         COUNT(*) FILTER (WHERE title ILIKE '[Chamado]%')::int AS chamados
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
  p.id,
  p.full_name,
  p.avatar_url,
  COALESCE(tt.total, 0),
  COALESCE(tt.chamados, 0),
  COALESCE(at.total, 0),
  COALESCE(s.xp, 0),
  COALESCE(lg.xp, 0),
  (COALESCE(tt.total, 0) * (SELECT xp_task FROM cfg)
    + COALESCE(at.total, 0) * (SELECT xp_auto FROM cfg)
    + COALESCE(s.xp, 0) + COALESCE(lg.xp, 0))::int,
  COALESCE((SELECT ma.medals FROM month_agg ma
             WHERE ma.uid = p.id
               AND ma.mkey = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM')), 0),
  COALESCE((SELECT SUM(ma.medals)::int FROM month_agg ma
             WHERE ma.uid = p.id
               AND left(ma.mkey, 4) = to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY')), 0),
  COALESCE((SELECT jsonb_agg(jsonb_build_object('key', ma.mkey, 'tasks', ma.tasks, 'autos', ma.autos, 'medals', ma.medals)
                             ORDER BY ma.mkey DESC)
            FROM month_agg ma WHERE ma.uid = p.id), '[]'::jsonb)
FROM public.profiles p
LEFT JOIN task_tot tt ON tt.uid = p.id
LEFT JOIN auto_tot at ON at.uid = p.id
LEFT JOIN ledger lg ON lg.uid = p.id
LEFT JOIN public.xp_seeds s ON s.user_id = p.id;
$$;

REVOKE ALL ON FUNCTION public.gamification_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gamification_stats() TO authenticated;
REVOKE ALL ON FUNCTION public.award_subtask_xp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_subtask_xp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_automation_bonus() FROM PUBLIC, anon, authenticated;