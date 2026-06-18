
-- 1) automations: UPDATE policy → authenticated + restrictive WITH CHECK
DROP POLICY IF EXISTS "Creators or assigned update automations" ON public.automations;
CREATE POLICY "Creators or assigned update automations"
  ON public.automations
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = created_by)
    OR (auth.uid() = assigned_to)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    (auth.uid() = created_by)
    OR (auth.uid() = assigned_to)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 2) tasks: UPDATE policy → authenticated + restrictive WITH CHECK
DROP POLICY IF EXISTS "Users can update assigned or created tasks" ON public.tasks;
CREATE POLICY "Users can update assigned or created tasks"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = created_by)
    OR (auth.uid() = assigned_to)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    (auth.uid() = created_by)
    OR (auth.uid() = assigned_to)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 3) sm_tasks: UPDATE policy → authenticated only
DROP POLICY IF EXISTS "Social staff update tasks" ON public.sm_tasks;
CREATE POLICY "Social staff update tasks"
  ON public.sm_tasks
  FOR UPDATE
  TO authenticated
  USING (
    has_social_access(auth.uid())
    AND (NOT has_social_role(auth.uid(), 'cliente'::social_role))
    AND (
      (auth.uid() = created_by)
      OR (auth.uid() = assigned_to)
      OR has_social_role(auth.uid(), 'admin'::social_role)
      OR has_social_role(auth.uid(), 'gestor'::social_role)
    )
  )
  WITH CHECK (
    has_social_access(auth.uid())
    AND (NOT has_social_role(auth.uid(), 'cliente'::social_role))
    AND (
      (auth.uid() = created_by)
      OR (auth.uid() = assigned_to)
      OR has_social_role(auth.uid(), 'admin'::social_role)
      OR has_social_role(auth.uid(), 'gestor'::social_role)
    )
  );

-- 4) automation_dependencies: tighten DELETE + UPDATE to creator or admin/gestor
DROP POLICY IF EXISTS "Authenticated users can delete automation dependencies" ON public.automation_dependencies;
CREATE POLICY "Creators or admins delete automation dependencies"
  ON public.automation_dependencies
  FOR DELETE
  TO authenticated
  USING (
    (auth.uid() = created_by)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
  );

DROP POLICY IF EXISTS "Auth update automation_dependencies" ON public.automation_dependencies;
CREATE POLICY "Creators or admins update automation dependencies"
  ON public.automation_dependencies
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = created_by)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
  )
  WITH CHECK (
    (auth.uid() = created_by)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
  );

-- 5) xp_logs: replace open INSERT policy with SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Users can insert own xp_logs" ON public.xp_logs;
-- No INSERT policy → only service_role / SECURITY DEFINER functions can write.

CREATE OR REPLACE FUNCTION public.award_xp(
  _user_id uuid,
  _task_id uuid,
  _action text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _xp integer;
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fixed XP amounts; reject unknown actions.
  _xp := CASE _action
    WHEN 'executed' THEN 10
    WHEN 'approved_lider' THEN 3
    WHEN 'approved_gestor' THEN 2
    ELSE NULL
  END;
  IF _xp IS NULL THEN
    RAISE EXCEPTION 'Invalid action: %', _action;
  END IF;

  -- Self-award only allowed for the approval actions that match the caller's role.
  IF _user_id = _caller THEN
    IF _action = 'approved_lider'
       AND NOT (has_role(_caller, 'lider'::app_role) OR has_role(_caller, 'gestor'::app_role) OR has_role(_caller, 'admin'::app_role)) THEN
      RAISE EXCEPTION 'Not allowed to award lider XP';
    END IF;
    IF _action = 'approved_gestor'
       AND NOT (has_role(_caller, 'gestor'::app_role) OR has_role(_caller, 'admin'::app_role)) THEN
      RAISE EXCEPTION 'Not allowed to award gestor XP';
    END IF;
    IF _action = 'executed' THEN
      RAISE EXCEPTION 'Executed XP must be granted by an approver';
    END IF;
  ELSE
    -- Awarding XP to someone else: only gestor/admin can do that, and only for 'executed'.
    IF _action <> 'executed' THEN
      RAISE EXCEPTION 'Only executed XP can be granted to other users';
    END IF;
    IF NOT (has_role(_caller, 'gestor'::app_role) OR has_role(_caller, 'admin'::app_role)) THEN
      RAISE EXCEPTION 'Only gestor/admin can grant executor XP';
    END IF;
  END IF;

  INSERT INTO public.xp_logs (user_id, task_id, action, xp_earned)
  VALUES (_user_id, _task_id, _action, _xp);
END;
$$;

REVOKE ALL ON FUNCTION public.award_xp(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.award_xp(uuid, uuid, text) TO authenticated;
