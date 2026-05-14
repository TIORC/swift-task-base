
DROP POLICY IF EXISTS "Social staff update events" ON public.sm_calendar_events;
DROP POLICY IF EXISTS "Creators or admin delete events" ON public.sm_calendar_events;

CREATE POLICY "Only leaders update events"
ON public.sm_calendar_events FOR UPDATE TO authenticated
USING (
  has_social_role(auth.uid(),'admin'::social_role)
  OR has_social_role(auth.uid(),'gestor'::social_role)
);

CREATE POLICY "Only leaders delete events"
ON public.sm_calendar_events FOR DELETE TO authenticated
USING (
  has_social_role(auth.uid(),'admin'::social_role)
  OR has_social_role(auth.uid(),'gestor'::social_role)
);
