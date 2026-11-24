-- Data em que a tarefa M7 foi concluída, para medir conclusões em atraso nos relatórios.
ALTER TABLE public.sm_tasks
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Tarefas já concluídas: usa a última atualização como aproximação.
UPDATE public.sm_tasks
SET completed_at = updated_at
WHERE status = 'concluido' AND completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_sm_task_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'concluido' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    ELSIF OLD.status IS DISTINCT FROM 'concluido' THEN
      NEW.completed_at := now();
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sm_tasks_completed_at ON public.sm_tasks;
CREATE TRIGGER trg_sm_tasks_completed_at
BEFORE INSERT OR UPDATE ON public.sm_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_sm_task_completed_at();
