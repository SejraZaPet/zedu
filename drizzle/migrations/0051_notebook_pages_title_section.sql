ALTER TABLE public.notebook_pages ADD COLUMN IF NOT EXISTS title text, ADD COLUMN IF NOT EXISTS section text;
NOTIFY pgrst, 'reload schema';