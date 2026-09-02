CREATE EXTENSION IF NOT EXISTS unaccent;

DROP FUNCTION IF EXISTS public.search_teacher_directory(text);

CREATE OR REPLACE FUNCTION public.search_teacher_directory(_term text)
RETURNS TABLE(id uuid, first_name text, last_name text, email text, same_school boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
  WITH t AS (
    SELECT
      btrim(coalesce(_term, '')) AS raw,
      replace(replace(replace(unaccent(lower(btrim(coalesce(_term, '')))), '\', '\\'), '%', '\%'), '_', '\_') AS pat,
      public.get_user_school_id(auth.uid()) AS my_school
  )
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    CASE WHEN t.my_school IS NOT NULL AND p.school_id = t.my_school THEN p.email ELSE NULL END AS email,
    (t.my_school IS NOT NULL AND p.school_id = t.my_school) AS same_school
  FROM public.profiles p
  CROSS JOIN t
  WHERE auth.uid() IS NOT NULL
    AND length(t.raw) >= 2
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.id
        AND ur.role IN ('teacher', 'lektor', 'admin', 'school_admin')
    )
    AND (
      unaccent(lower(coalesce(p.first_name, ''))) LIKE '%' || t.pat || '%'
      OR unaccent(lower(coalesce(p.last_name, ''))) LIKE '%' || t.pat || '%'
      OR unaccent(lower(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))) LIKE '%' || t.pat || '%'
      OR lower(coalesce(p.email, '')) = lower(t.raw)
    )
  ORDER BY (t.my_school IS NOT NULL AND p.school_id = t.my_school) DESC, p.last_name NULLS LAST
  LIMIT 20
$function$;

REVOKE ALL ON FUNCTION public.search_teacher_directory(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_teacher_directory(text) TO authenticated;