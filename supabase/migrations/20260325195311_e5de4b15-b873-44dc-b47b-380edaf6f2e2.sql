
CREATE TABLE public.user_medals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  medal_key TEXT NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, medal_key)
);

ALTER TABLE public.user_medals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read user_medals" ON public.user_medals FOR SELECT TO authenticated USING (true);
CREATE POLICY "System insert user_medals" ON public.user_medals FOR INSERT TO authenticated WITH CHECK (true);
