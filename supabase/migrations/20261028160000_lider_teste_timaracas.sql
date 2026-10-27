-- Teste: TI Maracas recebe o mesmo papel de líder do Welder, para testar
-- convidar responsáveis e definir o XP das automações.
-- Para remover depois: DELETE FROM public.user_roles WHERE role = 'lider' AND user_id = (SELECT id FROM auth.users WHERE email = 'timaracas@orcoma.com.br');

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'lider'::app_role FROM auth.users u
WHERE u.email = 'timaracas@orcoma.com.br'
ON CONFLICT DO NOTHING;
