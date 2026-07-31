CREATE UNIQUE INDEX IF NOT EXISTS sm_tasks_one_recurring_occurrence_per_day
ON public.sm_tasks (
  parent_recurring_task_id,
  ((created_at AT TIME ZONE 'America/Sao_Paulo')::date)
)
WHERE parent_recurring_task_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sm_posts_one_recurring_occurrence_per_day
ON public.sm_posts (
  parent_recurring_post_id,
  ((created_at AT TIME ZONE 'America/Sao_Paulo')::date)
)
WHERE parent_recurring_post_id IS NOT NULL;