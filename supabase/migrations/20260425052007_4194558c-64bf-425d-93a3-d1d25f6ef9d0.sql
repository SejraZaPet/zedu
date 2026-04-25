ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_code text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_email text;

UPDATE public.profiles
SET student_code = 'ZAK-' || upper(substring(md5(id::text) from 1 for 4))
WHERE student_code IS NULL;