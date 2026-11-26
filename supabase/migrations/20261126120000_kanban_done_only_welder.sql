-- Só o Welder pode mover tarefas do Kanban para "Concluído" (depois da validação dele).
-- Espelha canMoveKanbanTaskToDone no front (useKanbanTasks.ts). Bloqueia criar ou mover para done;
-- editar uma tarefa que já está concluída continua permitido.
CREATE OR REPLACE FUNCTION public.kanban_guard_done_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'done'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'done')
     AND auth.uid() IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND (lower(trim(p.full_name)) = 'welder' OR lower(trim(p.full_name)) LIKE 'welder %')
     )
  THEN
    RAISE EXCEPTION 'Só o Welder pode mover tarefas do Kanban para Concluído.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kanban_guard_done_status ON public.kanban_tasks;
CREATE TRIGGER kanban_guard_done_status
  BEFORE INSERT OR UPDATE OF status ON public.kanban_tasks
  FOR EACH ROW EXECUTE FUNCTION public.kanban_guard_done_status();
