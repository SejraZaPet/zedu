REVOKE EXECUTE ON FUNCTION public.is_teaching_unit_collaborator(uuid, uuid, uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_subject_collaborator_of(uuid, uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_validate_teaching_unit_collaborator() FROM anon, authenticated;