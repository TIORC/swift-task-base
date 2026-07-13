
CREATE TABLE public.recurring_task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  field text NOT NULL,
  old_value text,
  new_value text
);

CREATE INDEX idx_rth_task ON public.recurring_task_history(task_id, changed_at DESC);

GRANT SELECT, INSERT ON public.recurring_task_history TO authenticated;
GRANT ALL ON public.recurring_task_history TO service_role;

ALTER TABLE public.recurring_task_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view recurring history"
ON public.recurring_task_history FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR public.has_role(auth.uid(), 'lider'::app_role)
);

CREATE POLICY "System can insert recurring history"
ON public.recurring_task_history FOR INSERT TO authenticated
WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_recurring_task_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF NOT COALESCE(NEW.is_recurring_template, false)
     AND NOT COALESCE(OLD.is_recurring_template, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title THEN
    INSERT INTO public.recurring_task_history(task_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, _uid, 'title', OLD.title, NEW.title);
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    INSERT INTO public.recurring_task_history(task_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, _uid, 'description', OLD.description, NEW.description);
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.recurring_task_history(task_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, _uid, 'assigned_to', OLD.assigned_to::text, NEW.assigned_to::text);
  END IF;
  IF NEW.recurrence_type IS DISTINCT FROM OLD.recurrence_type THEN
    INSERT INTO public.recurring_task_history(task_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, _uid, 'recurrence_type', OLD.recurrence_type, NEW.recurrence_type);
  END IF;
  IF NEW.recurrence_interval IS DISTINCT FROM OLD.recurrence_interval THEN
    INSERT INTO public.recurring_task_history(task_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, _uid, 'recurrence_interval', OLD.recurrence_interval::text, NEW.recurrence_interval::text);
  END IF;
  IF NEW.recurrence_days IS DISTINCT FROM OLD.recurrence_days THEN
    INSERT INTO public.recurring_task_history(task_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, _uid, 'recurrence_days',
      array_to_string(OLD.recurrence_days, ','),
      array_to_string(NEW.recurrence_days, ','));
  END IF;
  IF NEW.recurrence_start_time IS DISTINCT FROM OLD.recurrence_start_time THEN
    INSERT INTO public.recurring_task_history(task_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, _uid, 'recurrence_start_time', OLD.recurrence_start_time, NEW.recurrence_start_time);
  END IF;
  IF NEW.recurrence_only_business_days IS DISTINCT FROM OLD.recurrence_only_business_days THEN
    INSERT INTO public.recurring_task_history(task_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, _uid, 'recurrence_only_business_days',
      OLD.recurrence_only_business_days::text, NEW.recurrence_only_business_days::text);
  END IF;
  IF NEW.recurrence_until IS DISTINCT FROM OLD.recurrence_until THEN
    INSERT INTO public.recurring_task_history(task_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, _uid, 'recurrence_until', OLD.recurrence_until::text, NEW.recurrence_until::text);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_recurring_task_changes
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_recurring_task_changes();
