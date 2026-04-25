CREATE OR REPLACE FUNCTION public.find_student_by_code(_code text)
RETURNS TABLE(id uuid, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name
  FROM public.profiles p
  WHERE p.student_code = _code
  LIMIT 1
$$;