-- ============================================================
-- Portal do solicitante: lookup de e-mail para a Edge Function.
-- ADITIVA: não altera policies RLS existentes nem GRANTs de anon.
-- ============================================================

-- A função roda com service_role dentro da Edge Function; o front NUNCA
-- a chama com a chave anon — por isso EXECUTE só para service_role.
CREATE OR REPLACE FUNCTION public.get_automation_requester_by_email(_email text)
RETURNS TABLE (user_id uuid, sector text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.user_id, r.sector
  FROM public.automation_requesters r
  JOIN auth.users u ON u.id = r.user_id
  WHERE lower(u.email) = lower(_email)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_automation_requester_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_automation_requester_by_email(text) TO service_role;

-- Leitura pontual da fila de /k7f3q9x2/solicitacoes pela função.
CREATE INDEX IF NOT EXISTS idx_automation_requesters_user
  ON public.automation_requesters(user_id);
