GRANT SELECT, INSERT, UPDATE, DELETE ON public.avatar_items TO authenticated;
GRANT ALL ON public.avatar_items TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.avatar_items FROM anon;
DROP POLICY IF EXISTS avatar_items_select ON public.avatar_items;
CREATE POLICY avatar_items_select
ON public.avatar_items
FOR SELECT
TO anon, authenticated
USING (is_active = true OR public.is_admin());