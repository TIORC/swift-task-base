
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS support_real_reason text,
  ADD COLUMN IF NOT EXISTS support_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS support_technical_notes text,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_support_real_reason ON public.tasks(support_real_reason) WHERE support_real_reason IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_support_tags ON public.tasks USING GIN (support_tags);
