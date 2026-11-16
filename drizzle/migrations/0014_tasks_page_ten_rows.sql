CREATE OR REPLACE FUNCTION public.tasks_page(_page integer DEFAULT 1, _selected_user text DEFAULT 'mine_or_unassigned', _statuses text[] DEFAULT NULL, _priority text DEFAULT NULL, _date_from timestamptz DEFAULT NULL, _date_to timestamptz DEFAULT NULL, _recurring boolean DEFAULT false, _weekday text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $fn$
WITH role_context AS (
 SELECT auth.uid() AS uid, NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('admin','gestor','lider')) AS member
), base AS NOT MATERIALIZED (
 SELECT t.* FROM public.tasks t CROSS JOIN role_context r
 WHERE r.uid IS NOT NULL AND t.title !~* '^\s*\[Chamado\]'
 AND (NOT r.member OR t.assigned_to=r.uid OR t.created_by=r.uid OR EXISTS(SELECT 1 FROM public.user_task_visibility v WHERE v.user_id=r.uid AND (v.target_user_id=t.assigned_to OR v.target_user_id=t.created_by)))
 AND CASE
 WHEN _selected_user='all' THEN true
 WHEN _selected_user='unassigned' THEN t.assigned_to IS NULL
 WHEN _selected_user='mine_or_unassigned' THEN t.assigned_to=r.uid OR t.assigned_to IS NULL
 WHEN r.member THEN t.assigned_to=r.uid
 WHEN _selected_user='mine' THEN t.assigned_to=r.uid OR t.created_by=r.uid
 ELSE t.assigned_to::text=_selected_user OR t.created_by::text=_selected_user END
), filtered AS NOT MATERIALIZED (
 SELECT * FROM base t WHERE
 (_statuses IS NULL OR t.status::text=ANY(_statuses)) AND (_priority IS NULL OR t.priority::text=_priority)
 AND (_date_from IS NULL OR t.created_at>=_date_from) AND (_date_to IS NULL OR t.created_at<=_date_to)
 AND (NOT _recurring OR coalesce(t.is_recurring_template,false) OR t.recurrence_type IS NOT NULL OR cardinality(t.recurrence_days)>0)
 AND (_weekday IS NULL OR CASE WHEN cardinality(t.recurrence_days)>0 THEN _weekday=ANY(t.recurrence_days)
 ELSE _weekday=(ARRAY['DOM','SEG','TER','QUA','QUI','SEX','SAB'])[extract(dow FROM t.due_date::timestamptz AT TIME ZONE 'America/Sao_Paulo')::integer+1] END)
), page_rows AS MATERIALIZED (
 SELECT * FROM filtered ORDER BY created_at DESC,id DESC LIMIT 10 OFFSET (greatest(coalesce(_page,1),1)-1)*10
), counts AS (
 SELECT jsonb_build_object('all',count(*),'open',count(*) FILTER(WHERE status IN ('backlog','todo')),'in_progress',count(*) FILTER(WHERE status='in_progress'),'pending',count(*) FILTER(WHERE status IN ('pending','review')),'done',count(*) FILTER(WHERE status='done'),'discarded',count(*) FILTER(WHERE status='discarded')) AS data FROM base
)
SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),'counts',(SELECT data FROM counts),'tasks',coalesce((
 SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('profiles',CASE WHEN pr.id IS NULL THEN NULL ELSE jsonb_build_object('full_name',pr.full_name,'avatar_url',pr.avatar_url) END,'total_minutes',coalesce(tm.minutes,0)) ORDER BY p.created_at DESC,p.id DESC)
 FROM page_rows p LEFT JOIN public.profiles pr ON pr.id=p.assigned_to
 LEFT JOIN LATERAL (SELECT sum(duration_minutes) AS minutes FROM public.time_logs WHERE task_id=p.id) tm ON true
),'[]'::jsonb));
$fn$;
REVOKE ALL ON FUNCTION public.tasks_page(integer,text,text[],text,timestamptz,timestamptz,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tasks_page(integer,text,text[],text,timestamptz,timestamptz,boolean,text) TO authenticated;
COMMENT ON FUNCTION public.tasks_page(integer,text,text[],text,timestamptz,timestamptz,boolean,text) IS 'Read-only /tasks pagination, fixed 10 rows; invoker RLS and existing contextual visibility. Rollback: DROP FUNCTION public.tasks_page(integer,text,text[],text,timestamptz,timestamptz,boolean,text).';