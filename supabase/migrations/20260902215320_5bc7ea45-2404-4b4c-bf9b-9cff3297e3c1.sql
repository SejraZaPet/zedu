
REVOKE EXECUTE ON FUNCTION public.is_teaching_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_school_class_as_teacher(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_teaching_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_school_class_as_teacher(uuid) TO authenticated;
