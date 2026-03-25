
-- Task attachments metadata
CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read task_attachments"
ON public.task_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert task_attachments"
ON public.task_attachments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete task_attachments"
ON public.task_attachments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Responsibility history
CREATE TABLE public.responsibility_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.responsibility_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read responsibility_history"
ON public.responsibility_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert responsibility_history"
ON public.responsibility_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() = changed_by);
