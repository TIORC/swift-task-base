ALTER POLICY "tci update" ON public.task_checklist_items WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_checklist_items.task_id AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid() OR public.has_role(auth.uid(),'gestor') OR public.has_role(auth.uid(),'admin'))));
ALTER POLICY "ktci update" ON public.kanban_task_checklist_items WITH CHECK (public.kanban_can_edit(task_id));
ALTER POLICY "kta update" ON public.kanban_task_attachments WITH CHECK (public.kanban_can_edit(task_id) AND (auth.uid() = user_id OR public.has_role(auth.uid(),'admin')));
ALTER POLICY "kanban update" ON public.kanban_tasks WITH CHECK (public.kanban_can_edit(id));

ALTER POLICY "mobile_entries_delete" ON public.inventory_mobile_entries USING (created_by = auth.uid() OR public.has_inventory_admin());
ALTER POLICY "mobile_entries_update" ON public.inventory_mobile_entries USING (created_by = auth.uid() OR public.has_inventory_admin()) WITH CHECK (created_by = auth.uid() OR public.has_inventory_admin());
ALTER POLICY "mobile_entries_read" ON public.inventory_mobile_entries USING (public.is_staff(auth.uid()));

ALTER POLICY "tarefas_gestta: exclusao" ON public.tarefas_gestta TO authenticated USING (public.is_staff(auth.uid()));
ALTER POLICY "tarefas_gestta: inclusao" ON public.tarefas_gestta TO authenticated WITH CHECK (public.is_staff(auth.uid()));
ALTER POLICY "tarefas_gestta: leitura" ON public.tarefas_gestta TO authenticated USING (public.is_staff(auth.uid()));

ALTER POLICY "Authenticated update automation_scope_items" ON public.automation_scope_items USING (public.can_manage_automation(automation_id, auth.uid())) WITH CHECK (public.can_manage_automation(automation_id, auth.uid()));
ALTER POLICY "Auth read automation_scope_items" ON public.automation_scope_items USING (public.can_view_automation(automation_id, auth.uid()));
ALTER POLICY "Authenticated insert automation_scope_items" ON public.automation_scope_items WITH CHECK (public.can_manage_automation(automation_id, auth.uid()));

ALTER POLICY "Authenticated can view support catalog" ON public.support_catalog USING (public.is_staff(auth.uid()));
ALTER POLICY "adm_ti_read" ON public.inventory_adm_ti USING (public.is_staff(auth.uid()));

ALTER POLICY "Authenticated view avatars" ON storage.objects USING (bucket_id = 'avatars' AND public.is_staff(auth.uid()));
ALTER POLICY "Authenticated users can upload task attachments" ON storage.objects WITH CHECK (bucket_id = 'task-attachments' AND owner_id = (select auth.uid()::text));