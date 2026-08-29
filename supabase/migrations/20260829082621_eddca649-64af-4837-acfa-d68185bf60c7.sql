CREATE OR REPLACE FUNCTION public.search_teacher_directory(_term text)
RETURNS TABLE (id uuid, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role IN ('teacher','lektor','admin')
  WHERE auth.uid() IS NOT NULL
    AND length(coalesce(_term, '')) >= 3
    AND (
      p.first_name ILIKE '%' || _term || '%'
      OR p.last_name ILIKE '%' || _term || '%'
      OR (coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) ILIKE '%' || _term || '%'
    )
  ORDER BY p.last_name NULLS LAST
  LIMIT 20
$$;

CREATE OR REPLACE FUNCTION public.teacher_display_names(_ids uuid[])
RETURNS TABLE (id uuid, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = ANY(_ids)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.id AND ur.role IN ('teacher','lektor','admin')
    )
$$;

REVOKE ALL ON FUNCTION public.search_teacher_directory(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_teacher_directory(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_teacher_directory(text) TO authenticated;
REVOKE ALL ON FUNCTION public.teacher_display_names(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.teacher_display_names(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.teacher_display_names(uuid[]) TO authenticated;