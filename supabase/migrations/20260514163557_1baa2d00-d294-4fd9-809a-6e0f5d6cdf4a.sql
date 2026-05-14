
CREATE TABLE public.sm_calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NULL,
  campaign_id uuid NULL,
  kind text NOT NULL DEFAULT 'evento',
  title text NOT NULL,
  description text,
  location text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  color text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sm_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Social users read events"
ON public.sm_calendar_events FOR SELECT TO authenticated
USING (
  has_social_access(auth.uid()) AND (
    NOT has_social_role(auth.uid(),'cliente'::social_role)
    OR client_id = ANY(user_client_ids(auth.uid()))
  )
);

CREATE POLICY "Social staff insert events"
ON public.sm_calendar_events FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND has_social_access(auth.uid())
  AND NOT has_social_role(auth.uid(),'cliente'::social_role)
);

CREATE POLICY "Social staff update events"
ON public.sm_calendar_events FOR UPDATE TO authenticated
USING (
  has_social_access(auth.uid())
  AND NOT has_social_role(auth.uid(),'cliente'::social_role)
);

CREATE POLICY "Creators or admin delete events"
ON public.sm_calendar_events FOR DELETE TO authenticated
USING (
  auth.uid() = created_by
  OR has_social_role(auth.uid(),'admin'::social_role)
  OR has_social_role(auth.uid(),'gestor'::social_role)
);

CREATE TRIGGER trg_sm_calendar_events_updated_at
BEFORE UPDATE ON public.sm_calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sm_calendar_events_starts ON public.sm_calendar_events(starts_at);
CREATE INDEX idx_sm_calendar_events_client ON public.sm_calendar_events(client_id);
