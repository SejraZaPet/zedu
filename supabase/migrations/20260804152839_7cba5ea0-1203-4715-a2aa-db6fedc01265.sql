GRANT EXECUTE ON FUNCTION public.get_login_password(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_login_password(uuid) FROM PUBLIC, anon;