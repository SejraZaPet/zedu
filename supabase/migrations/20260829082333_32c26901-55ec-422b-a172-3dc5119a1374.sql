DROP POLICY IF EXISTS "School members can view same school profiles" ON public.profiles;

CREATE OR REPLACE VIEW public.school_directory
WITH (security_invoker = false) AS
SELECT p.id, p.first_name, p.last_name, p.academic_title, p.school_id
FROM public.profiles p
WHERE p.school_id IS NOT NULL
  AND p.school_id = public.get_user_school_id(auth.uid());

REVOKE ALL ON public.school_directory FROM anon;
GRANT SELECT ON public.school_directory TO authenticated;
GRANT SELECT ON public.school_directory TO service_role;