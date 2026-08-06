DROP INDEX IF EXISTS public.sm_tasks_one_recurring_occurrence_per_day;

CREATE UNIQUE INDEX sm_tasks_one_recurring_occurrence_per_due_day
ON public.sm_tasks (
  parent_recurring_task_id,
  ((due_date AT TIME ZONE 'America/Sao_Paulo')::date)
)
WHERE parent_recurring_task_id IS NOT NULL
  AND due_date IS NOT NULL
  AND created_at >= TIMESTAMPTZ '2026-08-01 00:00:00+00';