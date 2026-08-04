ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS private_email text,
  ADD COLUMN IF NOT EXISTS work_email text,
  ADD COLUMN IF NOT EXISTS phone text;