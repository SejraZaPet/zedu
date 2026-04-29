REVOKE EXECUTE ON FUNCTION public.send_notification(text, text, text, uuid[], text, timestamptz, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.send_notification(text, text, text, uuid[], text, timestamptz, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_notification(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.cancel_notification(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.dispatch_scheduled_notifications() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public._fanout_broadcast(uuid) FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public._resolve_broadcast_recipients(public.notification_broadcasts) FROM anon, public, authenticated;