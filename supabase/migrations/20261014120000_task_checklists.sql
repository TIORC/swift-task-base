-- Checklist das tarefas de /tarefas.
-- Regra: a tarefa só pode ser concluída (status = 'done') se tiver pelo menos um item
-- e todos os itens estiverem marcados. Chamados ("[Chamado]") têm fluxo próprio e ficam de fora.

CREATE TABLE public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  content text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_checklist_items_task_idx ON public.task_checklist_items(task_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_checklist_items TO authenticated;
GRANT ALL ON public.task_checklist_items TO service_role;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado (a tabela tasks também é visível para todos).
CREATE POLICY "tci view" ON public.task_checklist_items FOR SELECT TO authenticated USING (true);

-- Escrita: mesma regra de UPDATE da tabela tasks (criador, responsável, gestor, admin).
CREATE POLICY "tci insert" ON public.task_checklist_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id
        AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid()
             OR public.has_role(auth.uid(), 'gestor'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "tci update" ON public.task_checklist_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id
        AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid()
             OR public.has_role(auth.uid(), 'gestor'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  )
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tci delete" ON public.task_checklist_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id
        AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid()
             OR public.has_role(auth.uid(), 'gestor'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- Gatilho: impede a conclusão enquanto o checklist não estiver completo.
-- Roda antes de gravar a mudança, então vale para qualquer caminho (lista, detalhe, aprovação etc.).
CREATE OR REPLACE FUNCTION public.tasks_require_checklist_before_done()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status = 'done'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'done')
     AND NEW.title NOT LIKE '[Chamado]%' THEN

    IF NOT EXISTS (SELECT 1 FROM public.task_checklist_items WHERE task_id = NEW.id) THEN
      RAISE EXCEPTION 'Adicione pelo menos um item no checklist antes de concluir a tarefa.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF EXISTS (SELECT 1 FROM public.task_checklist_items WHERE task_id = NEW.id AND done = false) THEN
      RAISE EXCEPTION 'Marque todos os itens do checklist antes de concluir a tarefa.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS tasks_require_checklist_before_done ON public.tasks;
CREATE TRIGGER tasks_require_checklist_before_done
  BEFORE INSERT OR UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_require_checklist_before_done();
