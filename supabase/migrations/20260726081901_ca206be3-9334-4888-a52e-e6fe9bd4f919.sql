
REVOKE EXECUTE ON FUNCTION public.school_license_usage(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.school_license_usage_all() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_license_usage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_license_usage_all() TO authenticated;
