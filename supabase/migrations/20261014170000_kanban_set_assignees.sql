-- Troca os responsáveis de uma tarefa do Kanban numa única operação.
-- Usa a mesma regra de edição de kanban_can_edit (criador, responsável atual, sem responsável,
-- admin ou líder) e devolve uma mensagem clara quando o usuário não pode alterar a lista.
CREATE OR REPLACE FUNCTION public.kanban_set_assignees(_task_id uuid, _user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT public.kanban_can_edit(_task_id) THEN
    RAISE EXCEPTION 'Você não pode alterar os responsáveis desta tarefa.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  DELETE FROM public.kanban_task_assignees WHERE task_id = _task_id;

  INSERT INTO public.kanban_task_assignees (task_id, user_id)
  SELECT _task_id, uid FROM unnest(COALESCE(_user_ids, '{}'::uuid[])) AS uid
  ON CONFLICT DO NOTHING;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.kanban_set_assignees(uuid, uuid[]) TO authenticated;
