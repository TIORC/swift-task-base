ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS responsible_id uuid;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_day_of_month integer,
  ADD COLUMN IF NOT EXISTS recurrence_months integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recurrence_business_day_direction text NOT NULL DEFAULT 'next',
  ADD COLUMN IF NOT EXISTS recurrence_deadline_days integer;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_recurrence_bd_direction_check
  CHECK (recurrence_business_day_direction IN ('next','previous'));

CREATE OR REPLACE FUNCTION public.log_recurring_task_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF NEW.recurrence_day_of_month IS DISTINCT FROM OLD.recurrence_day_of_month THEN
    INSERT INTO public.recurring_task_history(task_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, _uid, 'recurrence_day_of_month', OLD.recurrence_day_of_month::text, NEW.recurrence_day_of_month::text);
  END IF;
  IF NEW.recurrence_months IS DISTINCT FROM OLD.recurrence_months THEN
    INSERT INTO public.recurring_task_history(task_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, _uid, 'recurrence_months',
      array_to_string(OLD.recurrence_months, ','), array_to_string(NEW.recurrence_months, ','));
  END IF;
  IF NEW.recurrence_business_day_direction IS DISTINCT FROM OLD.recurrence_business_day_direction THEN
    INSERT INTO public.recurring_task_history(task_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, _uid, 'recurrence_business_day_direction', OLD.recurrence_business_day_direction, NEW.recurrence_business_day_direction);
  END IF;
  IF NEW.recurrence_deadline_days IS DISTINCT FROM OLD.recurrence_deadline_days THEN
    INSERT INTO public.recurring_task_history(task_id, changed_by, field, old_value, new_value)
    VALUES (NEW.id, _uid, 'recurrence_deadline_days', OLD.recurrence_deadline_days::text, NEW.recurrence_deadline_days::text);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_recurring_task_changes ON public.tasks;
CREATE TRIGGER trg_log_recurring_task_changes
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_recurring_task_changes();