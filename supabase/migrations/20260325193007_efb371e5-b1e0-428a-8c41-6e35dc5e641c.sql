
DROP POLICY "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Users create notifications with own id"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
