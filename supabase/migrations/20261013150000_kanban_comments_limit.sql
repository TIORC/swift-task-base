-- Limite de 1000 comentários por tarefa do Kanban.
-- O app já avisa antes; este gatilho garante o limite no banco.

CREATE OR REPLACE FUNCTION public.kanban_comments_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.kanban_task_comments WHERE task_id = NEW.task_id) >= 1000 THEN
    RAISE EXCEPTION 'Limite de 1000 comentários por tarefa atingido.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER kanban_comments_limit
  BEFORE INSERT ON public.kanban_task_comments
  FOR EACH ROW EXECUTE FUNCTION public.kanban_comments_limit();
