-- Tabela de acesso por sistema
CREATE TABLE public.user_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  system text NOT NULL CHECK (system IN ('ti','social')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, system)
);

ALTER TABLE public.user_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own systems"
  ON public.user_systems FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage systems"
  ON public.user_systems FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Backfill: todos os usuários atuais têm acesso a TI
INSERT INTO public.user_systems (user_id, system, enabled)
SELECT id, 'ti', true FROM auth.users
ON CONFLICT (user_id, system) DO NOTHING;

-- timaracas ganha acesso aos dois
INSERT INTO public.user_systems (user_id, system, enabled)
SELECT u.id, s.system, true
FROM auth.users u
CROSS JOIN (VALUES ('ti'), ('social')) AS s(system)
WHERE u.email = 'timaracas@orcoma.com.br'
ON CONFLICT (user_id, system) DO NOTHING;

-- Trigger: novo usuário ganha acesso default a TI
CREATE OR REPLACE FUNCTION public.grant_default_system_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_systems (user_id, system, enabled)
  VALUES (NEW.id, 'ti', true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_systems ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_systems
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_default_system_access();