-- Checklist das tarefas de /tarefas.
-- Regra: criar um checklist é opcional. Se a tarefa tiver itens, todos precisam estar marcados
-- para ela ser concluída (status = 'done'). Tarefas sem itens podem ser concluídas normalmente.
-- Chamados ("[Chamado]") têm fluxo próprio e ficam de fora.
-- Script repetível: pode ser rodado de novo mesmo se uma tentativa anterior já criou parte dele.

CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  content text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_checklist_items_task_idx ON public.task_checklist_items(task_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_checklist_items TO authenticated;
GRANT ALL ON public.task_checklist_items TO service_role;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado (a tabela tasks também é visível para todos).
DROP POLICY IF EXISTS "tci view" ON public.task_checklist_items;
CREATE POLICY "tci view" ON public.task_checklist_items FOR SELECT TO authenticated USING (true);

-- Escrita: mesma regra de UPDATE da tabela tasks (criador, responsável, gestor, admin).
DROP POLICY IF EXISTS "tci insert" ON public.task_checklist_items;
CREATE POLICY "tci insert" ON public.task_checklist_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id
        AND (t.created_by = auth.uid() OR t.assigned_to = auth.uid()
             OR public.has_role(auth.uid(), 'gestor'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

DROP POLICY IF EXISTS "tci update" ON public.task_checklist_items;
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

DROP POLICY IF EXISTS "tci delete" ON public.task_checklist_items;
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
