
CREATE TABLE public.hippocampus_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'note' CHECK (type IN ('idea','tip','warning','reminder','link','vault','note')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  reminder_at TIMESTAMPTZ,
  reminder_repeat TEXT CHECK (reminder_repeat IN ('none','daily','weekly','monthly')),
  reminder_seen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hippocampus_notes_user ON public.hippocampus_notes(user_id);
CREATE INDEX idx_hippocampus_notes_reminder ON public.hippocampus_notes(reminder_at) WHERE reminder_at IS NOT NULL AND reminder_seen = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hippocampus_notes TO authenticated;
GRANT ALL ON public.hippocampus_notes TO service_role;

ALTER TABLE public.hippocampus_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or admin can select notes"
  ON public.hippocampus_notes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner can insert own notes"
  ON public.hippocampus_notes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner can update own notes"
  ON public.hippocampus_notes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner can delete own notes"
  ON public.hippocampus_notes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_hippocampus_notes_updated_at
  BEFORE UPDATE ON public.hippocampus_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
