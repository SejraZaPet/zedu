ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_code TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles ((lower(username)));