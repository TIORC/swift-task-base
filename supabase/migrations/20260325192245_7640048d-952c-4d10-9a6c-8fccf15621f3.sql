
ALTER TABLE public.time_logs
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ALTER COLUMN duration_minutes SET DEFAULT 0;
