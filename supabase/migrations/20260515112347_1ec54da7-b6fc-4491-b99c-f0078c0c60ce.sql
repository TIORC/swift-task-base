ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS legal_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS meta_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS legal_is_business_day boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta_is_business_day boolean NOT NULL DEFAULT false;