ALTER TABLE public.demo_pairs ADD COLUMN IF NOT EXISTS extension_until timestamptz;
COMMENT ON COLUMN public.demo_pairs.extension_until IS 'One-time extension: pair is kept at least until this time (set by demo_extend_once).';

CREATE OR REPLACE FUNCTION public.demo_pair_deletes_at(_pair_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT greatest(
           greatest(dp.last_active_at, pt.last_active_at, ps.last_active_at)
             + make_interval(days => (SELECT inactive_days FROM public.demo_config LIMIT 1)),
           dp.extension_until)
  FROM public.demo_pairs dp
  LEFT JOIN public.profiles pt ON pt.id = dp.teacher_user_id
  LEFT JOIN public.profiles ps ON ps.id = dp.student_user_id
  WHERE dp.id = _pair_id
$$;
REVOKE EXECUTE ON FUNCTION public.demo_pair_deletes_at(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_pair_deletes_at(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.demo_cleanup_candidates()
 RETURNS TABLE(pair_id uuid, teacher_user_id uuid, student_user_id uuid, last_active timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT dp.id, dp.teacher_user_id, dp.student_user_id,
         greatest(dp.last_active_at, pt.last_active_at, ps.last_active_at) AS la
  FROM public.demo_pairs dp
  LEFT JOIN public.profiles pt ON pt.id = dp.teacher_user_id
  LEFT JOIN public.profiles ps ON ps.id = dp.student_user_id
  WHERE greatest(dp.last_active_at, pt.last_active_at, ps.last_active_at)
        < now() - make_interval(days => (SELECT inactive_days FROM public.demo_config LIMIT 1))
    AND (dp.extension_until IS NULL OR dp.extension_until < now())
  ORDER BY la
  LIMIT (SELECT cleanup_batch FROM public.demo_config LIMIT 1)
$function$;
REVOKE EXECUTE ON FUNCTION public.demo_cleanup_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_cleanup_candidates() TO service_role;

CREATE OR REPLACE FUNCTION public.demo_extend_once()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.demo_my_pair_id(); cur timestamptz; nxt timestamptz;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Not a demo account' USING ERRCODE = '42501'; END IF;
  SELECT public.demo_pair_deletes_at(pid) INTO cur;
  nxt := greatest(cur, now()) + interval '14 days';
  UPDATE public.demo_pairs SET extended_at = now(), extension_until = nxt
   WHERE id = pid AND extended_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Already extended' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.demo_contacts
     SET reminder_3d_sent_at = NULL, reminder_1d_sent_at = NULL, reminder_deadline_at = NULL, updated_at = now()
   WHERE pair_id = pid;
  RETURN nxt;
END $$;
REVOKE EXECUTE ON FUNCTION public.demo_extend_once() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demo_extend_once() TO authenticated;