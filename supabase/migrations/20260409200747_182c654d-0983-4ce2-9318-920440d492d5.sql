
-- 1. Fix user_medals: restrict INSERT to admins only
DROP POLICY IF EXISTS "System insert user_medals" ON public.user_medals;
CREATE POLICY "Only admins can insert user_medals"
  ON public.user_medals FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Fix xp_logs: restrict INSERT to own user_id only
DROP POLICY IF EXISTS "System insert xp_logs" ON public.xp_logs;
CREATE POLICY "Users can insert own xp_logs"
  ON public.xp_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Fix notifications: also enforce user can only create notifications where created_by = auth.uid()
-- The existing policy only checks created_by but not user_id target
DROP POLICY IF EXISTS "Users create notifications with own id" ON public.notifications;
CREATE POLICY "Users create notifications with own created_by"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Also allow admins to create notifications for any user
CREATE POLICY "Admins can create any notification"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Fix time_logs: restrict SELECT to own logs + admins/gestors
DROP POLICY IF EXISTS "Users can view all time logs" ON public.time_logs;
CREATE POLICY "Users can view own time logs"
  ON public.time_logs FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
  );

-- 5. Fix storage: add RLS policies for task-attachments bucket
CREATE POLICY "Authenticated users can read task attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can upload task attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Users can delete own task attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own task attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 6. Fix realtime: add RLS on realtime.messages
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can use realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (true);
