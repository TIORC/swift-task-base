-- 1) Permissão explícita de acesso global por setor
CREATE TABLE IF NOT EXISTS public.user_global_sector_access (
  user_id uuid PRIMARY KEY,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_global_sector_access TO authenticated;
GRANT ALL ON public.user_global_sector_access TO service_role;

ALTER TABLE public.user_global_sector_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own global access" ON public.user_global_sector_access;
CREATE POLICY "Users read own global access" ON public.user_global_sector_access
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage global access" ON public.user_global_sector_access;
CREATE POLICY "Admins manage global access" ON public.user_global_sector_access
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Histórico administrativo de alteração de setor
CREATE TABLE IF NOT EXISTS public.user_sector_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  old_sectors text[] NOT NULL DEFAULT '{}',
  new_sectors text[] NOT NULL DEFAULT '{}',
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_sector_history_user_idx ON public.user_sector_history (user_id, changed_at DESC);

GRANT SELECT, INSERT ON public.user_sector_history TO authenticated;
GRANT ALL ON public.user_sector_history TO service_role;

ALTER TABLE public.user_sector_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read sector history" ON public.user_sector_history;
CREATE POLICY "Admins read sector history" ON public.user_sector_history
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins write sector history" ON public.user_sector_history;
CREATE POLICY "Admins write sector history" ON public.user_sector_history
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND changed_by = auth.uid());

-- 3) Função de acesso global explícito
CREATE OR REPLACE FUNCTION public.has_global_sector_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
     OR EXISTS (
       SELECT 1 FROM public.user_global_sector_access g WHERE g.user_id = _user_id
     );
$$;

-- 4) Acesso setorial sem o fallback "sem setor = TI"
CREATE OR REPLACE FUNCTION public.has_sector_access(_user_id uuid, _sector text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_global_sector_access(_user_id)
    OR (
      _sector IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.user_sectors us
        WHERE us.user_id = _user_id AND us.sector = _sector
      )
    );
$$;

-- 5) Acesso global às automações passa a depender da permissão explícita
CREATE OR REPLACE FUNCTION public.has_global_automation_access(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_global_sector_access(_user);
$$;

-- 6) Validação do setor também na escrita
DROP POLICY IF EXISTS "Auth create automations" ON public.automations;
CREATE POLICY "Auth create automations" ON public.automations
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by AND public.has_sector_access(auth.uid(), sector));

DROP POLICY IF EXISTS "Managers requesters update automations" ON public.automations;
CREATE POLICY "Managers requesters update automations" ON public.automations
FOR UPDATE TO authenticated
USING (
  public.can_manage_automation(id, auth.uid())
  OR auth.uid() = created_by
  OR auth.uid() = requester_id
)
WITH CHECK (
  (
    public.can_manage_automation(id, auth.uid())
    OR auth.uid() = created_by
    OR auth.uid() = requester_id
  )
  AND public.has_sector_access(auth.uid(), sector)
);

REVOKE ALL ON FUNCTION public.has_global_sector_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_global_sector_access(uuid) TO authenticated, service_role;
