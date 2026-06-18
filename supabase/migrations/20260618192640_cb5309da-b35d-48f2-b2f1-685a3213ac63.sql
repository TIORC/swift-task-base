CREATE POLICY "Authenticated users can update support tickets"
ON public.tasks
FOR UPDATE
TO authenticated
USING (title LIKE '[Chamado]%')
WITH CHECK (title LIKE '[Chamado]%');