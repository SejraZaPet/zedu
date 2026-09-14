ALTER TABLE public.academy_modules
  ADD COLUMN IF NOT EXISTS content_blocks JSONB;