-- ============= ENUMS =============
DO $$ BEGIN
  CREATE TYPE public.social_role AS ENUM ('admin', 'gestor', 'social_media', 'designer', 'redator', 'cliente');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.sm_post_status AS ENUM ('ideia', 'roteiro', 'design', 'revisao_interna', 'aprovacao_cliente', 'agendado', 'publicado', 'reprovado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.sm_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============= USER SOCIAL ROLES =============
CREATE TABLE IF NOT EXISTS public.user_social_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role public.social_role NOT NULL DEFAULT 'social_media',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_social_roles ENABLE ROW LEVEL SECURITY;

-- helper function
CREATE OR REPLACE FUNCTION public.has_social_role(_user_id uuid, _role public.social_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_social_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_social_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_systems
    WHERE user_id = _user_id AND system = 'social' AND enabled = true
  )
$$;

CREATE POLICY "Users view own social roles" ON public.user_social_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_social_role(auth.uid(), 'admin'));
CREATE POLICY "Social admins manage roles" ON public.user_social_roles
  FOR ALL TO authenticated
  USING (public.has_social_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_social_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'admin'));

-- ============= CLIENTS =============
CREATE TABLE IF NOT EXISTS public.sm_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  brand_identity text,
  general_briefing text,
  useful_links jsonb DEFAULT '[]'::jsonb,
  logo_url text,
  primary_color text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sm_clients ENABLE ROW LEVEL SECURITY;

-- ============= CLIENT USERS (portal do cliente) =============
CREATE TABLE IF NOT EXISTS public.sm_client_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.sm_clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  is_approver boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, user_id)
);
ALTER TABLE public.sm_client_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_client_ids(_user_id uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(client_id), '{}') FROM public.sm_client_users WHERE user_id = _user_id
$$;

-- Clients policies
CREATE POLICY "Social users read clients" ON public.sm_clients
  FOR SELECT TO authenticated USING (
    public.has_social_access(auth.uid()) AND (
      NOT public.has_social_role(auth.uid(), 'cliente')
      OR id = ANY(public.user_client_ids(auth.uid()))
    )
  );
CREATE POLICY "Social staff insert clients" ON public.sm_clients
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = created_by AND public.has_social_access(auth.uid())
    AND NOT public.has_social_role(auth.uid(), 'cliente')
  );
CREATE POLICY "Social staff update clients" ON public.sm_clients
  FOR UPDATE TO authenticated USING (
    public.has_social_access(auth.uid()) AND NOT public.has_social_role(auth.uid(), 'cliente')
  );
CREATE POLICY "Social admin delete clients" ON public.sm_clients
  FOR DELETE TO authenticated USING (
    public.has_social_role(auth.uid(), 'admin') OR public.has_social_role(auth.uid(), 'gestor')
  );

-- Client_users policies
CREATE POLICY "Social staff read client_users" ON public.sm_client_users
  FOR SELECT TO authenticated USING (
    public.has_social_access(auth.uid()) AND (
      user_id = auth.uid() OR NOT public.has_social_role(auth.uid(), 'cliente')
    )
  );
CREATE POLICY "Social admins manage client_users" ON public.sm_client_users
  FOR ALL TO authenticated
  USING (public.has_social_role(auth.uid(), 'admin') OR public.has_social_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_social_role(auth.uid(), 'admin') OR public.has_social_role(auth.uid(), 'gestor'));

-- ============= CAMPAIGNS =============
CREATE TABLE IF NOT EXISTS public.sm_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.sm_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'planning',
  budget numeric,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sm_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Social users read campaigns" ON public.sm_campaigns
  FOR SELECT TO authenticated USING (
    public.has_social_access(auth.uid()) AND (
      NOT public.has_social_role(auth.uid(), 'cliente')
      OR client_id = ANY(public.user_client_ids(auth.uid()))
    )
  );
CREATE POLICY "Social staff insert campaigns" ON public.sm_campaigns
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = created_by AND public.has_social_access(auth.uid())
    AND NOT public.has_social_role(auth.uid(), 'cliente')
  );
CREATE POLICY "Social staff update campaigns" ON public.sm_campaigns
  FOR UPDATE TO authenticated USING (
    public.has_social_access(auth.uid()) AND NOT public.has_social_role(auth.uid(), 'cliente')
  );
CREATE POLICY "Social admin delete campaigns" ON public.sm_campaigns
  FOR DELETE TO authenticated USING (
    public.has_social_role(auth.uid(), 'admin') OR public.has_social_role(auth.uid(), 'gestor')
  );

-- ============= SOCIAL NETWORKS =============
CREATE TABLE IF NOT EXISTS public.sm_social_networks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  icon text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sm_social_networks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Social users read networks" ON public.sm_social_networks
  FOR SELECT TO authenticated USING (public.has_social_access(auth.uid()));
CREATE POLICY "Social admins manage networks" ON public.sm_social_networks
  FOR ALL TO authenticated
  USING (public.has_social_role(auth.uid(), 'admin') OR public.has_social_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_social_role(auth.uid(), 'admin') OR public.has_social_role(auth.uid(), 'gestor'));

-- ============= CONTENT TYPES =============
CREATE TABLE IF NOT EXISTS public.sm_content_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sm_content_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Social users read content_types" ON public.sm_content_types
  FOR SELECT TO authenticated USING (public.has_social_access(auth.uid()));
CREATE POLICY "Social admins manage content_types" ON public.sm_content_types
  FOR ALL TO authenticated
  USING (public.has_social_role(auth.uid(), 'admin') OR public.has_social_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_social_role(auth.uid(), 'admin') OR public.has_social_role(auth.uid(), 'gestor'));

-- ============= POSTS =============
CREATE TABLE IF NOT EXISTS public.sm_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.sm_clients(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.sm_campaigns(id) ON DELETE SET NULL,
  network_id uuid REFERENCES public.sm_social_networks(id) ON DELETE SET NULL,
  content_type_id uuid REFERENCES public.sm_content_types(id) ON DELETE SET NULL,
  title text NOT NULL,
  caption text,
  hashtags text,
  scheduled_at timestamptz,
  published_at timestamptz,
  status public.sm_post_status NOT NULL DEFAULT 'ideia',
  priority public.sm_priority NOT NULL DEFAULT 'medium',
  assigned_to uuid,
  created_by uuid NOT NULL,
  recurrence_type text,
  recurrence_interval integer DEFAULT 1,
  recurrence_until timestamptz,
  is_recurring_template boolean NOT NULL DEFAULT false,
  parent_recurring_post_id uuid,
  last_spawned_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sm_posts_client ON public.sm_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_sm_posts_status ON public.sm_posts(status);
CREATE INDEX IF NOT EXISTS idx_sm_posts_scheduled ON public.sm_posts(scheduled_at);
ALTER TABLE public.sm_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Social users read posts" ON public.sm_posts
  FOR SELECT TO authenticated USING (
    public.has_social_access(auth.uid()) AND (
      NOT public.has_social_role(auth.uid(), 'cliente')
      OR (client_id = ANY(public.user_client_ids(auth.uid()))
          AND status IN ('aprovacao_cliente', 'agendado', 'publicado'))
    )
  );
CREATE POLICY "Social staff insert posts" ON public.sm_posts
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = created_by AND public.has_social_access(auth.uid())
    AND NOT public.has_social_role(auth.uid(), 'cliente')
  );
CREATE POLICY "Social staff update posts" ON public.sm_posts
  FOR UPDATE TO authenticated USING (
    public.has_social_access(auth.uid()) AND (
      NOT public.has_social_role(auth.uid(), 'cliente')
      OR (client_id = ANY(public.user_client_ids(auth.uid()))
          AND status = 'aprovacao_cliente')
    )
  );
CREATE POLICY "Creators or admins delete posts" ON public.sm_posts
  FOR DELETE TO authenticated USING (
    auth.uid() = created_by OR public.has_social_role(auth.uid(), 'admin') OR public.has_social_role(auth.uid(), 'gestor')
  );

-- ============= POST APPROVALS =============
CREATE TABLE IF NOT EXISTS public.sm_post_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.sm_posts(id) ON DELETE CASCADE,
  level text NOT NULL,
  approver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  comments text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sm_post_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Social users read approvals" ON public.sm_post_approvals
  FOR SELECT TO authenticated USING (
    public.has_social_access(auth.uid()) AND (
      NOT public.has_social_role(auth.uid(), 'cliente')
      OR EXISTS (SELECT 1 FROM public.sm_posts p WHERE p.id = sm_post_approvals.post_id
                 AND p.client_id = ANY(public.user_client_ids(auth.uid())))
    )
  );
CREATE POLICY "Approvers insert approvals" ON public.sm_post_approvals
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = approver_id AND public.has_social_access(auth.uid())
  );
CREATE POLICY "Approvers update own approvals" ON public.sm_post_approvals
  FOR UPDATE TO authenticated USING (auth.uid() = approver_id);

-- ============= POST COMMENTS =============
CREATE TABLE IF NOT EXISTS public.sm_post_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.sm_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  mentions uuid[] DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sm_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Social users read comments" ON public.sm_post_comments
  FOR SELECT TO authenticated USING (
    public.has_social_access(auth.uid()) AND (
      NOT public.has_social_role(auth.uid(), 'cliente')
      OR EXISTS (SELECT 1 FROM public.sm_posts p WHERE p.id = sm_post_comments.post_id
                 AND p.client_id = ANY(public.user_client_ids(auth.uid())))
    )
  );
CREATE POLICY "Users insert own comments" ON public.sm_post_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_social_access(auth.uid()));
CREATE POLICY "Users delete own comments" ON public.sm_post_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============= POST ATTACHMENTS =============
CREATE TABLE IF NOT EXISTS public.sm_post_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.sm_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sm_post_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Social users read attachments" ON public.sm_post_attachments
  FOR SELECT TO authenticated USING (
    public.has_social_access(auth.uid()) AND (
      NOT public.has_social_role(auth.uid(), 'cliente')
      OR EXISTS (SELECT 1 FROM public.sm_posts p WHERE p.id = sm_post_attachments.post_id
                 AND p.client_id = ANY(public.user_client_ids(auth.uid())))
    )
  );
CREATE POLICY "Users insert own attachments" ON public.sm_post_attachments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_social_access(auth.uid()));
CREATE POLICY "Users delete own attachments" ON public.sm_post_attachments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============= IDEAS =============
CREATE TABLE IF NOT EXISTS public.sm_ideas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.sm_clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  tags text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'new',
  converted_to_post_id uuid REFERENCES public.sm_posts(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sm_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Social staff read ideas" ON public.sm_ideas
  FOR SELECT TO authenticated USING (
    public.has_social_access(auth.uid()) AND NOT public.has_social_role(auth.uid(), 'cliente')
  );
CREATE POLICY "Social staff insert ideas" ON public.sm_ideas
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = created_by AND public.has_social_access(auth.uid())
    AND NOT public.has_social_role(auth.uid(), 'cliente')
  );
CREATE POLICY "Social staff update ideas" ON public.sm_ideas
  FOR UPDATE TO authenticated USING (
    public.has_social_access(auth.uid()) AND NOT public.has_social_role(auth.uid(), 'cliente')
  );
CREATE POLICY "Creators delete ideas" ON public.sm_ideas
  FOR DELETE TO authenticated USING (
    auth.uid() = created_by OR public.has_social_role(auth.uid(), 'admin')
  );

-- ============= BRIEFINGS =============
CREATE TABLE IF NOT EXISTS public.sm_briefings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.sm_clients(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.sm_campaigns(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sm_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Social users read briefings" ON public.sm_briefings
  FOR SELECT TO authenticated USING (
    public.has_social_access(auth.uid()) AND (
      NOT public.has_social_role(auth.uid(), 'cliente')
      OR client_id = ANY(public.user_client_ids(auth.uid()))
    )
  );
CREATE POLICY "Social staff insert briefings" ON public.sm_briefings
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = created_by AND public.has_social_access(auth.uid())
    AND NOT public.has_social_role(auth.uid(), 'cliente')
  );
CREATE POLICY "Social staff update briefings" ON public.sm_briefings
  FOR UPDATE TO authenticated USING (
    public.has_social_access(auth.uid()) AND NOT public.has_social_role(auth.uid(), 'cliente')
  );
CREATE POLICY "Creators delete briefings" ON public.sm_briefings
  FOR DELETE TO authenticated USING (
    auth.uid() = created_by OR public.has_social_role(auth.uid(), 'admin') OR public.has_social_role(auth.uid(), 'gestor')
  );

-- ============= METRICS =============
CREATE TABLE IF NOT EXISTS public.sm_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.sm_posts(id) ON DELETE CASCADE,
  reach integer DEFAULT 0,
  impressions integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares integer DEFAULT 0,
  saves integer DEFAULT 0,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  measured_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sm_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Social users read metrics" ON public.sm_metrics
  FOR SELECT TO authenticated USING (
    public.has_social_access(auth.uid()) AND (
      NOT public.has_social_role(auth.uid(), 'cliente')
      OR EXISTS (SELECT 1 FROM public.sm_posts p WHERE p.id = sm_metrics.post_id
                 AND p.client_id = ANY(public.user_client_ids(auth.uid())))
    )
  );
CREATE POLICY "Social staff insert metrics" ON public.sm_metrics
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = created_by AND public.has_social_access(auth.uid())
    AND NOT public.has_social_role(auth.uid(), 'cliente')
  );
CREATE POLICY "Social staff update metrics" ON public.sm_metrics
  FOR UPDATE TO authenticated USING (
    public.has_social_access(auth.uid()) AND NOT public.has_social_role(auth.uid(), 'cliente')
  );
CREATE POLICY "Creators delete metrics" ON public.sm_metrics
  FOR DELETE TO authenticated USING (
    auth.uid() = created_by OR public.has_social_role(auth.uid(), 'admin')
  );

-- ============= TASKS (operacionais) =============
CREATE TABLE IF NOT EXISTS public.sm_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.sm_clients(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.sm_campaigns(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'backlog',
  priority public.sm_priority NOT NULL DEFAULT 'medium',
  assigned_to uuid,
  due_date timestamptz,
  recurrence_type text,
  recurrence_interval integer DEFAULT 1,
  recurrence_until timestamptz,
  is_recurring_template boolean NOT NULL DEFAULT false,
  parent_recurring_task_id uuid,
  last_spawned_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Social staff read tasks" ON public.sm_tasks
  FOR SELECT TO authenticated USING (
    public.has_social_access(auth.uid()) AND NOT public.has_social_role(auth.uid(), 'cliente')
  );
CREATE POLICY "Social staff insert tasks" ON public.sm_tasks
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = created_by AND public.has_social_access(auth.uid())
    AND NOT public.has_social_role(auth.uid(), 'cliente')
  );
CREATE POLICY "Social staff update tasks" ON public.sm_tasks
  FOR UPDATE TO authenticated USING (
    public.has_social_access(auth.uid()) AND NOT public.has_social_role(auth.uid(), 'cliente')
    AND (auth.uid() = created_by OR auth.uid() = assigned_to OR public.has_social_role(auth.uid(), 'admin') OR public.has_social_role(auth.uid(), 'gestor'))
  );
CREATE POLICY "Creators delete tasks" ON public.sm_tasks
  FOR DELETE TO authenticated USING (
    auth.uid() = created_by OR public.has_social_role(auth.uid(), 'admin')
  );

-- ============= TRIGGERS updated_at =============
DROP TRIGGER IF EXISTS trg_sm_clients_upd ON public.sm_clients;
CREATE TRIGGER trg_sm_clients_upd BEFORE UPDATE ON public.sm_clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_sm_campaigns_upd ON public.sm_campaigns;
CREATE TRIGGER trg_sm_campaigns_upd BEFORE UPDATE ON public.sm_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_sm_posts_upd ON public.sm_posts;
CREATE TRIGGER trg_sm_posts_upd BEFORE UPDATE ON public.sm_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_sm_ideas_upd ON public.sm_ideas;
CREATE TRIGGER trg_sm_ideas_upd BEFORE UPDATE ON public.sm_ideas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_sm_briefings_upd ON public.sm_briefings;
CREATE TRIGGER trg_sm_briefings_upd BEFORE UPDATE ON public.sm_briefings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_sm_metrics_upd ON public.sm_metrics;
CREATE TRIGGER trg_sm_metrics_upd BEFORE UPDATE ON public.sm_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_sm_tasks_upd ON public.sm_tasks;
CREATE TRIGGER trg_sm_tasks_upd BEFORE UPDATE ON public.sm_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= REALTIME =============
ALTER TABLE public.sm_posts REPLICA IDENTITY FULL;
ALTER TABLE public.sm_post_comments REPLICA IDENTITY FULL;
ALTER TABLE public.sm_post_approvals REPLICA IDENTITY FULL;
ALTER TABLE public.sm_tasks REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sm_posts;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sm_post_comments;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sm_post_approvals;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sm_tasks;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============= SEEDS =============
INSERT INTO public.sm_social_networks (name, icon) VALUES
  ('Instagram', 'instagram'),
  ('TikTok', 'music'),
  ('Facebook', 'facebook'),
  ('LinkedIn', 'linkedin'),
  ('YouTube', 'youtube'),
  ('Twitter/X', 'twitter')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.sm_content_types (name, description) VALUES
  ('Reels', 'Vídeo curto vertical'),
  ('Story', 'Conteúdo efêmero 24h'),
  ('Carrossel', 'Múltiplas imagens'),
  ('Post estático', 'Imagem única no feed'),
  ('Vídeo longo', 'Vídeo > 90s'),
  ('Live', 'Transmissão ao vivo')
ON CONFLICT (name) DO NOTHING;

-- Grant admin SM e role admin para timaracas
INSERT INTO public.user_social_roles (user_id, role)
SELECT id, 'admin'::public.social_role FROM auth.users WHERE email = 'timaracas@orcoma.com.br'
ON CONFLICT DO NOTHING;