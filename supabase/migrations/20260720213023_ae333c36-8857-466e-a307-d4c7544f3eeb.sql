GRANT SELECT, INSERT, UPDATE, DELETE ON public.avatar_item_base_variants TO authenticated;
GRANT ALL ON public.avatar_item_base_variants TO service_role;
NOTIFY pgrst, 'reload schema';