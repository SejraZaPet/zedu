ALTER TABLE public.demo_pairs ADD COLUMN IF NOT EXISTS extended_at timestamptz;
ALTER TABLE public.demo_config ADD COLUMN IF NOT EXISTS reminder_max_per_run integer NOT NULL DEFAULT 60;

CREATE TABLE public.demo_contacts (
  pair_id uuid PRIMARY KEY REFERENCES public.demo_pairs(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  consent_at timestamptz NOT NULL DEFAULT now(),
  consent_version text NOT NULL,
  consent_text_hash text NOT NULL,
  reminder_3d_sent_at timestamptz,
  reminder_1d_sent_at timestamptz,
  reminder_deadline_at timestamptz,
  unsubscribe_token_hashes text[] NOT NULL DEFAULT '{}',
  transfer_token_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.demo_contacts.transfer_token_hash IS 'Reserved for stage 3 (transfer); unused.';
REVOKE ALL ON public.demo_contacts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.demo_contacts TO service_role;
ALTER TABLE public.demo_contacts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.demo_pair_deletes_at(_pair_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT greatest(dp.last_active_at, pt.last_active_at, ps.last_active_at)
         + make_interval(days => (SELECT inactive_days FROM public.demo_config LIMIT 1))
  FROM public.demo_pairs dp
  LEFT JOIN public.profiles pt ON pt.id = dp.teacher_user_id
  LEFT JOIN public.profiles ps ON ps.id = dp.student_user_id
  WHERE dp.id = _pair_id
$$;
REVOKE EXECUTE ON FUNCTION public.demo_pair_deletes_at(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_pair_deletes_at(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.demo_my_pair_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id FROM public.demo_pairs d
  WHERE auth.uid() IS NOT NULL AND (d.teacher_user_id = auth.uid() OR d.student_user_id = auth.uid())
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.demo_my_pair_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_my_pair_id() TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_demo_expiry()
RETURNS TABLE(deletes_at timestamptz, days_left integer, extended boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT x.d, greatest(0, ceil(extract(epoch FROM (x.d - now())) / 86400.0))::integer, (dp.extended_at IS NOT NULL)
  FROM public.demo_pairs dp
  CROSS JOIN LATERAL (SELECT public.demo_pair_deletes_at(dp.id) AS d) x
  WHERE dp.id = public.demo_my_pair_id()
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_demo_expiry() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_demo_expiry() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_demo_contact_status()
RETURNS TABLE(has_contact boolean, email_masked text, consent_version text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (c.pair_id IS NOT NULL),
         CASE WHEN c.email IS NULL THEN NULL
              ELSE left(split_part(c.email,'@',1),1) || '***@' || split_part(c.email,'@',2) END,
         c.consent_version
  FROM (SELECT public.demo_my_pair_id() AS pid) me
  LEFT JOIN public.demo_contacts c ON c.pair_id = me.pid
  WHERE me.pid IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_demo_contact_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_demo_contact_status() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.demo_extend_once()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid := public.demo_my_pair_id();
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'Not a demo account' USING ERRCODE = '42501'; END IF;
  UPDATE public.demo_pairs SET extended_at = now(), last_active_at = now()
   WHERE id = pid AND extended_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Already extended' USING ERRCODE = 'P0001'; END IF;
  RETURN public.demo_pair_deletes_at(pid);
END $$;
REVOKE EXECUTE ON FUNCTION public.demo_extend_once() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demo_extend_once() TO authenticated;

CREATE OR REPLACE FUNCTION public.demo_claim_reminders(_limit integer)
RETURNS TABLE(pair_id uuid, email text, kind text, deletes_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.demo_contacts c
     SET reminder_3d_sent_at = NULL, reminder_1d_sent_at = NULL, reminder_deadline_at = NULL, updated_at = now()
   WHERE c.reminder_deadline_at IS NOT NULL
     AND public.demo_pair_deletes_at(c.pair_id) > c.reminder_deadline_at + interval '12 hours';

  RETURN QUERY
  WITH due AS (
    SELECT c.pair_id AS pid, c.email AS em, public.demo_pair_deletes_at(c.pair_id) AS d,
           c.reminder_1d_sent_at AS r1, c.reminder_3d_sent_at AS r3
    FROM public.demo_contacts c
  ), pick AS (
    SELECT due.pid, due.em, due.d,
      CASE WHEN due.d > now() AND due.d <= now() + interval '1 day' AND due.r1 IS NULL THEN '1d'
           WHEN due.d > now() + interval '1 day' AND due.d <= now() + interval '3 days' AND due.r3 IS NULL AND due.r1 IS NULL THEN '3d'
      END AS k
    FROM due
  ), lim AS (
    SELECT * FROM pick WHERE pick.k IS NOT NULL ORDER BY (pick.k = '1d') DESC, pick.d LIMIT greatest(0, _limit)
  ), upd AS (
    UPDATE public.demo_contacts c
       SET reminder_1d_sent_at = CASE WHEN lim.k = '1d' THEN now() ELSE c.reminder_1d_sent_at END,
           reminder_3d_sent_at = coalesce(c.reminder_3d_sent_at, now()),
           reminder_deadline_at = lim.d, updated_at = now()
      FROM lim WHERE c.pair_id = lim.pid
    RETURNING c.pair_id AS upid
  )
  SELECT lim.pid, lim.em, lim.k, lim.d FROM lim JOIN upd ON upd.upid = lim.pid;
END $$;
REVOKE EXECUTE ON FUNCTION public.demo_claim_reminders(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_claim_reminders(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.demo_release_reminder(_pair_id uuid, _kind text, _had_3d boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.demo_contacts
     SET reminder_1d_sent_at = CASE WHEN _kind = '1d' THEN NULL ELSE reminder_1d_sent_at END,
         reminder_3d_sent_at = CASE WHEN _had_3d THEN reminder_3d_sent_at ELSE NULL END,
         updated_at = now()
   WHERE pair_id = _pair_id
$$;
REVOKE EXECUTE ON FUNCTION public.demo_release_reminder(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_release_reminder(uuid, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.demo_purge_pair(_pair_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p public.demo_pairs; ids uuid[]; r record; n bigint; total jsonb := '{}'::jsonb; failed int; pass int;
BEGIN
  SELECT * INTO p FROM public.demo_pairs WHERE id = _pair_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  ids := ARRAY[p.teacher_user_id, p.student_user_id];
  IF EXISTS (SELECT 1 FROM public.demo_shared_users WHERE user_id = ANY(ids)) THEN
    RAISE EXCEPTION 'demo_purge_pair: shared user in pair';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(ids) u WHERE NOT public.is_demo_user(u)) THEN
    RAISE EXCEPTION 'demo_purge_pair: non-demo user in pair';
  END IF;

  DELETE FROM public.demo_contacts WHERE pair_id = _pair_id;
  GET DIAGNOSTICS n = ROW_COUNT; total := total || jsonb_build_object('demo_contacts', n);

  DELETE FROM public.assignment_attempts WHERE assignment_id IN
    (SELECT id FROM public.assignments WHERE teacher_id = ANY(ids) AND NOT is_demo_seed);
  GET DIAGNOSTICS n = ROW_COUNT; total := total || jsonb_build_object('assignment_attempts_in_pair_assignments', n);
  DELETE FROM public.class_members WHERE class_id IN
    (SELECT id FROM public.classes WHERE created_by = ANY(ids) AND NOT is_demo_seed);
  GET DIAGNOSTICS n = ROW_COUNT; total := total || jsonb_build_object('class_members_in_pair_classes', n);

  FOR pass IN 1..5 LOOP
    failed := 0;
    FOR r IN
      SELECT c.table_name, c.column_name,
             EXISTS (SELECT 1 FROM information_schema.columns x WHERE x.table_schema='public'
                     AND x.table_name=c.table_name AND x.column_name='is_demo_seed') AS has_seed
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
      WHERE c.table_schema='public' AND t.table_type='BASE TABLE' AND c.data_type='uuid'
        AND c.column_name IN ('teacher_id','owner_id','student_id','user_id','created_by','sender_id','author_id','reporter_id')
        AND c.table_name NOT IN ('demo_pairs','demo_shared_users','demo_ai_usage','profiles','user_roles','demo_cleanup_log','demo_seed_snapshot')
      ORDER BY c.table_name
    LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE %I = ANY($1)%s', r.table_name, r.column_name,
                       CASE WHEN r.has_seed THEN ' AND NOT is_demo_seed' ELSE '' END) USING ids;
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n > 0 THEN
          total := total || jsonb_build_object(r.table_name, coalesce((total->>r.table_name)::bigint,0) + n);
        END IF;
      EXCEPTION WHEN foreign_key_violation THEN failed := failed + 1;
      END;
    END LOOP;
    EXIT WHEN failed = 0;
  END LOOP;
  RETURN total;
END $function$;
REVOKE EXECUTE ON FUNCTION public.demo_purge_pair(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_purge_pair(uuid) TO service_role;