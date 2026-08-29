REVOKE ALL ON FUNCTION public.check_reservation_conflict() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_reservation_changed_by_other() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_manage_reservation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resource_in_my_school(uuid) FROM PUBLIC, anon;