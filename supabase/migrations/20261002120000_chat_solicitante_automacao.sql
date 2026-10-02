-- Chat entre solicitante e equipe de TI na própria solicitação.
-- A tabela automation_comments já guardava a conversa e as policies de RLS já
-- liberavam leitura/inserção para quem pode ver a automação (created_by,
-- requester_id, assigned_to ou gestor). O que faltava era o realtime, para a
-- mensagem chegar na tela do outro lado sem recarregar a página.

ALTER TABLE public.automation_comments REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_comments;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Índice de leitura por conversa: o filtro da tela de acompanhamento e do chat
-- do dev é sempre automation_id + created_at.
CREATE INDEX IF NOT EXISTS idx_automation_comments_thread
  ON public.automation_comments(automation_id, created_at);
