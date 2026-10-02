CREATE TABLE IF NOT EXISTS public.automation_requesters (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sector text NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_requesters_sector ON public.automation_requesters(sector);
GRANT SELECT ON public.automation_requesters TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_requesters TO service_role;
ALTER TABLE public.automation_requesters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Requesters read own record" ON public.automation_requesters;
CREATE POLICY "Requesters read own record" ON public.automation_requesters FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins manage requesters" ON public.automation_requesters;
CREATE POLICY "Admins manage requesters" ON public.automation_requesters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_automation_requester(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.automation_requesters WHERE user_id = _user_id)
         OR public.has_role(_user_id, 'admin')
$$;

INSERT INTO public.automation_requesters (user_id, sector, granted_by)
SELECT u.id, v.sector, NULL
FROM (VALUES
  ('geane.lopes@orcoma.com.br','DC'),('danicarla@orcoma.com.br','DC'),('talita.silva@orcoma.com.br','DC'),
  ('jonatas.braga@orcoma.com.br','DC'),('joyce.narde@orcoma.com.br','DF'),('saulo.assis@orcoma.com.br','DF'),
  ('olandson@orcoma.com.br','Qualidade'),('kaylane.oliveira@orcoma.com.br','Qualidade'),('suzane.souza@orcoma.com.br','RH'),
  ('samuel.rizzuto@orcoma.com.br','DS'),('macleide@orcoma.com.br','SC'),('gilton.novaes@orcoma.com.br','Comercial'),
  ('patrick.leite@orcoma.com.br','M7'),('daniel.silva@orcoma.com.br','M7')
) AS v(email, sector)
JOIN auth.users u ON u.email = v.email
ON CONFLICT (user_id) DO UPDATE SET sector = EXCLUDED.sector;

DO $$
DECLARE _r record;
BEGIN
  FOR _r IN
    SELECT u.id AS user_id, v.role, v.sector
    FROM (VALUES
      ('welder@orcoma.com.br','dev'::app_role,'TI'),
      ('gabriel.anacleto@orcoma.com.br','dev'::app_role,'TI'),
      ('angel.kauan@orcoma.com.br','suporte'::app_role,'TI'),
      ('sofia.nardes@orcoma.com.br','suporte'::app_role,'TI')
    ) AS v(email, role, sector)
    JOIN auth.users u ON u.email = v.email
  LOOP
    INSERT INTO public.user_roles (user_id, role) VALUES (_r.user_id, _r.role) ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.user_systems (user_id, system, enabled) VALUES (_r.user_id, 'ti', true)
      ON CONFLICT (user_id, system) DO UPDATE SET enabled = true;
    INSERT INTO public.user_sectors (user_id, sector) VALUES (_r.user_id, _r.sector) ON CONFLICT (user_id, sector) DO NOTHING;
    INSERT INTO public.automation_requesters (user_id, sector, granted_by) VALUES (_r.user_id, _r.sector, NULL)
      ON CONFLICT (user_id) DO UPDATE SET sector = EXCLUDED.sector;
  END LOOP;
END $$;

INSERT INTO public.user_sectors (user_id, sector)
SELECT r.user_id, r.sector FROM public.automation_requesters r
ON CONFLICT (user_id, sector) DO NOTHING;

DROP POLICY IF EXISTS "Auth create automations" ON public.automations;
CREATE POLICY "Auth create automations" ON public.automations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND (status IS DISTINCT FROM 'requested' OR public.is_automation_requester(auth.uid())));

CREATE OR REPLACE FUNCTION public.get_automation_requester_by_email(_email text)
RETURNS TABLE (user_id uuid, sector text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.user_id, r.sector FROM public.automation_requesters r
  JOIN auth.users u ON u.id = r.user_id
  WHERE lower(u.email) = lower(_email) LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_automation_requester_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_automation_requester_by_email(text) TO service_role;
CREATE INDEX IF NOT EXISTS idx_automation_requesters_user ON public.automation_requesters(user_id);