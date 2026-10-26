CREATE INDEX IF NOT EXISTS idx_task_events_completed ON public.task_events (task_id, created_at) WHERE event_type = 'completed';
CREATE INDEX IF NOT EXISTS idx_automation_events_status ON public.automation_events (automation_id, created_at) WHERE event_type = 'status_changed';
CREATE INDEX IF NOT EXISTS idx_tasks_status_assigned ON public.tasks (status, assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_logs_task ON public.time_logs (task_id);