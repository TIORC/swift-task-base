
-- Create task_events table for full timeline tracking
CREATE TABLE public.task_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookup by task
CREATE INDEX idx_task_events_task_id ON public.task_events(task_id);
CREATE INDEX idx_task_events_created_at ON public.task_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.task_events ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read events
CREATE POLICY "Auth read task_events"
  ON public.task_events FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert events
CREATE POLICY "Auth insert task_events"
  ON public.task_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for task_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_events;
