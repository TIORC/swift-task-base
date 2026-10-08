-- ============================================================
-- Roster correto das abas de status em /k7f3q9x2/solicitacoes.
--
-- Antes a Edge Function `solicitacoes` usava get_ti_assignable_user_ids()
-- (papéis member/dev/lider) nas DUAS abas. Isso fazia a aba
-- "Status dos Desenvolvedores" vazar qualquer solicitante com o papel
-- padrão `member` (ex.: Danicarla) e a aba "Status dos Suportes/Infra"
-- chamava get_support_assignable_user_ids, RPC que nunca existiu — o
-- cliente Supabase não lança exceção em erro de RPC, devolve
-- {data: null, error}, então a aba voltava vazia sem log nenhum.
--
-- Estas funções separam as equipes por papel:
--   get_developer_user_ids()         -> papel 'dev'      (Welder, Gabriel)
--   get_support_assignable_user_ids()-> papel 'suporte'  (Angel, Sofia)
--
-- get_ti_assignable_user_ids() NÃO é alterada: continua servindo ao
-- quadro de tarefas (/tarefas) e ao aviso de chamados sem responsável.
-- Aditivo, idempotente, SECURITY DEFINER + search_path fixo.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_developer_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT user_id), '{}')
  FROM public.user_roles
  WHERE role = 'dev';
$function$;

CREATE OR REPLACE FUNCTION public.get_support_assignable_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT user_id), '{}')
  FROM public.user_roles
  WHERE role = 'suporte';
$function$;

-- Diagnóstico: quem entrou em cada equipe. A aba Desenvolvedores precisa
-- listar Welder e Gabriel; a de Suportes/Infra, Angel e Sofia.
DO $$
DECLARE
  _devs text;
  _support text;
BEGIN
  SELECT string_agg(p.full_name, ', ' ORDER BY p.full_name) INTO _devs
  FROM public.user_roles r JOIN public.profiles p ON p.id = r.user_id
  WHERE r.role = 'dev';

  SELECT string_agg(p.full_name, ', ' ORDER BY p.full_name) INTO _support
  FROM public.user_roles r JOIN public.profiles p ON p.id = r.user_id
  WHERE r.role = 'suporte';

  RAISE NOTICE 'Aba Desenvolvedores (papel dev): %', COALESCE(_devs, '(vazio)');
  RAISE NOTICE 'Aba Suportes/Infra (papel suporte): %', COALESCE(_support, '(vazio)');
END $$;
