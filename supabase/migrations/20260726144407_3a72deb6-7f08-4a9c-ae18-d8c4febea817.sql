ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accessibility_settings jsonb NOT NULL DEFAULT '{}'::jsonb;