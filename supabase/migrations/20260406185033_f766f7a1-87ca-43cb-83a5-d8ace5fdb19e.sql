
-- Table: which users' tasks can a user see
CREATE TABLE public.user_task_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_user_id)
);

ALTER TABLE public.user_task_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage task visibility"
  ON public.user_task_visibility FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own visibility"
  ON public.user_task_visibility FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Table: per-user menu access overrides
CREATE TABLE public.user_menu_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  menu_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, menu_key)
);

ALTER TABLE public.user_menu_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage menu access"
  ON public.user_menu_access FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own menu access"
  ON public.user_menu_access FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
