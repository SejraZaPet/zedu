REVOKE ALL PRIVILEGES ON public.avatar_items FROM anon;
GRANT SELECT ON public.avatar_items TO anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON public.avatar_items FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avatar_items TO authenticated;
GRANT ALL ON public.avatar_items TO service_role;