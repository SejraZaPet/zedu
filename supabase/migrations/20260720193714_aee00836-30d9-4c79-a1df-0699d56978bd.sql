DROP POLICY IF EXISTS avatar_items_select ON public.avatar_items;
DROP POLICY IF EXISTS avatar_items_public_select ON public.avatar_items;
DROP POLICY IF EXISTS avatar_items_authenticated_select ON public.avatar_items;

CREATE POLICY avatar_items_public_select
ON public.avatar_items
FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY avatar_items_authenticated_select
ON public.avatar_items
FOR SELECT
TO authenticated
USING (is_active = true OR public.is_admin());