-- Capa com cor/gradiente (estilo Trello) para as tarefas do Kanban.
-- Quando preenchida, tem prioridade sobre a foto anexada. Valor = chave em src/lib/kanban-covers.ts.
ALTER TABLE public.kanban_tasks ADD COLUMN IF NOT EXISTS cover_preset text;
