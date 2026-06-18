
ALTER TABLE public.task_dependencies ADD COLUMN IF NOT EXISTS line_color text;
ALTER TABLE public.automation_dependencies ADD COLUMN IF NOT EXISTS line_color text;

CREATE TABLE IF NOT EXISTS public.dependency_map_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type text NOT NULL CHECK (node_type IN ('task','automation')),
  node_id uuid NOT NULL,
  position_x numeric NOT NULL DEFAULT 0,
  position_y numeric NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (node_type, node_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dependency_map_positions TO authenticated;
GRANT ALL ON public.dependency_map_positions TO service_role;

ALTER TABLE public.dependency_map_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read map positions" ON public.dependency_map_positions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert map positions" ON public.dependency_map_positions
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update map positions" ON public.dependency_map_positions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete map positions" ON public.dependency_map_positions
  FOR DELETE TO authenticated USING (true);

-- Also allow any authenticated user to update a dependency line color (currently no update policies exist)
DROP POLICY IF EXISTS "Auth update task_dependencies" ON public.task_dependencies;
CREATE POLICY "Auth update task_dependencies" ON public.task_dependencies
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth update automation_dependencies" ON public.automation_dependencies;
CREATE POLICY "Auth update automation_dependencies" ON public.automation_dependencies
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
