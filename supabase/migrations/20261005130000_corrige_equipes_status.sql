-- ============================================================
-- Corrige as equipes das abas de status de /k7f3q9x2/solicitacoes.
--
-- O QUE ESTAVA ERRADO
--   A migration 20261001120000 gravou os papéis certos no papel, mas o banco
--   de produção nunca chegou a ficar assim: nela Angel/Sofia carregavam o papel
--   `dev` e Welder/Gabriel carregavam `suporte` — o contrário. Como as abas
--   passam a lista pelo papel, elas saíram trocadas: Welder e Gabriel apareciam
--   em "Status dos Suportes/Infra" e Angel e Sofia em "Status dos Desenvolvedores".
--
--   Além disso, `user_roles` guarda um papel por linha e a migration anterior
--   só fazia INSERT ... ON CONFLICT DO NOTHING: ela nunca remove o papel
--   trocado, então corrigir apenas inserindo não resolveria nada.
--
-- O QUE ESTA MIGRATION FAZ
--   1) Garante o papel correto de cada um dos quatro.
--   2) Remove o papel invertido de cada um dos quatro.
--   3) Trava as duas listas por E-MAIL, para que nenhum `dev`/`suporte` órfão
--      que sobrou no banco volte a contaminar a aba — a Danicarla e qualquer
--      outro solicitante com o papel padrão `member` ficam fora por construção.
--
-- Para incluir alguém novo na aba, acrescente o e-mail na lista da equipe
-- correspondente em get_developer_user_ids() / get_support_assignable_user_ids()
-- e dê o papel correspondente em user_roles.
-- ============================================================

-- ── 1) Papéis corretos ────────────────────────────────────────────────
-- 'sofia.nardes@' é o e-mail correto (corrigido em 20261001130000); o
-- 'sofia.narde@' sem o "s" fica como alternativa caso o cadastro real seja esse.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, v.role::app_role
FROM (VALUES
  ('welder@orcoma.com.br',           'dev'::app_role),
  ('gabriel.anacleto@orcoma.com.br', 'dev'::app_role),
  ('angel.kauan@orcoma.com.br',      'suporte'::app_role),
  ('sofia.nardes@orcoma.com.br',     'suporte'::app_role),
  ('sofia.narde@orcoma.com.br',      'suporte'::app_role)
) AS v(email, role)
JOIN auth.users u ON u.email = v.email
ON CONFLICT (user_id, role) DO NOTHING;

-- ── 2) Remove o papel invertido ───────────────────────────────────────
-- Welder e Gabriel não são de Suporte/Infra.
DELETE FROM public.user_roles
WHERE role = 'suporte'::app_role
  AND user_id IN (
    SELECT id FROM auth.users
    WHERE email IN ('welder@orcoma.com.br', 'gabriel.anacleto@orcoma.com.br')
  );

-- Angel e Sofia não são Desenvolvedores.
DELETE FROM public.user_roles
WHERE role = 'dev'::app_role
  AND user_id IN (
    SELECT id FROM auth.users
    WHERE email IN ('angel.kauan@orcoma.com.br', 'sofia.nardes@orcoma.com.br', 'sofia.narde@orcoma.com.br')
  );

-- ── 3) Equipes travadas por e-mail ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_developer_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- A aba "Status dos Desenvolvedores" é EXCLUSIVAMENTE Welder e Gabriel.
  SELECT COALESCE(array_agg(DISTINCT u.id), '{}')
  FROM auth.users u
  WHERE u.email IN ('welder@orcoma.com.br', 'gabriel.anacleto@orcoma.com.br');
$function$;

CREATE OR REPLACE FUNCTION public.get_support_assignable_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- A aba "Status dos Suportes/Infra" é EXCLUSIVAMENTE Angel e Sofia.
  SELECT COALESCE(array_agg(DISTINCT u.id), '{}')
  FROM auth.users u
  WHERE u.email IN ('angel.kauan@orcoma.com.br', 'sofia.nardes@orcoma.com.br', 'sofia.narde@orcoma.com.br');
$function$;

-- ── Diagnóstico: como cada aba vai responder após esta migration ───────
DO $$
DECLARE
  _devs text;
  _support text;
BEGIN
  SELECT string_agg(p.full_name, ', ' ORDER BY p.full_name) INTO _devs
  FROM public.get_developer_user_ids() f
  JOIN public.profiles p ON p.id = f;

  SELECT string_agg(p.full_name, ', ' ORDER BY p.full_name) INTO _support
  FROM public.get_support_assignable_user_ids() f
  JOIN public.profiles p ON p.id = f;

  RAISE NOTICE 'Aba Desenvolvedores -> %', COALESCE(_devs, '(vazio)');
  RAISE NOTICE 'Aba Suportes/Infra -> %', COALESCE(_support, '(vazio)');
END $$;
