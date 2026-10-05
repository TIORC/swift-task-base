ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS upgrade_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS last_upgrade_at timestamptz;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS upgrade_details jsonb;
NOTIFY pgrst, 'reload schema';