-- Link de destino da notificação (ex.: "/tasks?task=<id>" ou "/kanban?task=<id>").
-- Permite abrir a tarefa exata ao clicar no alerta, mesmo quando a tarefa é do Kanban.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;
