DROP VIEW IF EXISTS public.school_directory;

CREATE OR REPLACE FUNCTION public.school_directory()
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  academic_title text,
  school_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, p.academic_title, p.school_id
  FROM public.profiles p
  WHERE p.school_id IS NOT NULL
    AND p.school_id = public.get_user_school_id(auth.uid())
$$;

REVOKE ALL ON FUNCTION public.school_directory() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.school_directory() FROM anon;
GRANT EXECUTE ON FUNCTION public.school_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_directory() TO service_role;