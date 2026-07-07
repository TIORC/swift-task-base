CREATE TABLE public.user_automation_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, automation_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_automation_visibility TO authenticated;
GRANT ALL ON public.user_automation_visibility TO service_role;

ALTER TABLE public.user_automation_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own automation visibility"
ON public.user_automation_visibility FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin manages automation visibility"
ON public.user_automation_visibility FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_uav_user ON public.user_automation_visibility(user_id);
CREATE INDEX idx_uav_automation ON public.user_automation_visibility(automation_id);