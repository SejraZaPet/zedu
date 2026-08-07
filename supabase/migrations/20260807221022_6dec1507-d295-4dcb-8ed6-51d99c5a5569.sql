CREATE OR REPLACE FUNCTION public.my_school_sale_settings()
RETURNS TABLE(school_id uuid, school_name text, allows_teacher_creators boolean, creator_payout_recipient text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.allows_teacher_creators, s.creator_payout_recipient
  FROM public.profiles p
  JOIN public.schools s ON s.id = p.school_id
  WHERE p.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.my_school_sale_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_school_sale_settings() TO authenticated;

REVOKE ALL ON FUNCTION public.can_creator_sell(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_creator_sell(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.creator_payout_target(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creator_payout_target(uuid) TO service_role;