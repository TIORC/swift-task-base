-- Link direto do conteúdo para aprovação (ex.: arquivo, post ou pasta), exibido na tela de Aprovações.
ALTER TABLE public.sm_tasks
  ADD COLUMN IF NOT EXISTS approval_link text;
