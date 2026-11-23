-- ============================================================================
-- /support: "O que foi feito para solucionar esse caso?" vira uma lista
-- cadastrável (com "+ Cadastrar novo"), no lugar das tags de submotivo.
-- ============================================================================

-- Novo tipo de cadastro no catálogo de suporte.
ALTER TABLE public.support_catalog DROP CONSTRAINT IF EXISTS support_catalog_kind_check;
ALTER TABLE public.support_catalog
  ADD CONSTRAINT support_catalog_kind_check
  CHECK (kind IN ('system', 'site', 'equipment', 'solution'));

-- Solução escolhida ao concluir o chamado.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS support_solution text;
