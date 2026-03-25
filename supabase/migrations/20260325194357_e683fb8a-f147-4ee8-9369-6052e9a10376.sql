
-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dev';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lider';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor';

-- Approvals table
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('lider', 'gestor')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read approvals" ON public.approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Approvers insert approvals" ON public.approvals FOR INSERT TO authenticated WITH CHECK (auth.uid() = approver_id);
CREATE POLICY "Approvers update own approvals" ON public.approvals FOR UPDATE TO authenticated USING (auth.uid() = approver_id);

-- XP logs table
CREATE TABLE public.xp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('executed', 'approved_lider', 'approved_gestor')),
  xp_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.xp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read xp_logs" ON public.xp_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "System insert xp_logs" ON public.xp_logs FOR INSERT TO authenticated WITH CHECK (true);
