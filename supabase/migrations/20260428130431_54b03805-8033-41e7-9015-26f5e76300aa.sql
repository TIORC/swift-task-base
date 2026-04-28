
-- Automation comments (with mentions)
CREATE TABLE IF NOT EXISTS public.automation_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read automation_comments"
  ON public.automation_comments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users insert own automation_comments"
  ON public.automation_comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own automation_comments"
  ON public.automation_comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_automation_comments_automation ON public.automation_comments(automation_id, created_at DESC);

-- Recurrence on tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_type TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_recurring_template BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_recurring_task_id UUID,
  ADD COLUMN IF NOT EXISTS last_spawned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_recurring_template ON public.tasks(is_recurring_template) WHERE is_recurring_template = true;
