ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_days TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS recurrence_start_time TEXT NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS recurrence_only_business_days BOOLEAN NOT NULL DEFAULT false;