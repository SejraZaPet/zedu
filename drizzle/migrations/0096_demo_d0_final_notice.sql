-- NÁVRH KE SCHVÁLENÍ – NEAPLIKOVÁNO.
-- D−0, poslední pražský kalendářní den D a jediný závěrečný e-mail jen pro souhlas v2.

ALTER TABLE public.demo_contacts ADD COLUMN IF NOT EXISTS reminder_0d_sent_at timestamptz;
ALTER TABLE public.demo_contacts ADD COLUMN IF NOT EXISTS final_email_claimed_at timestamptz;
COMMENT ON COLUMN public.demo_contacts.reminder_1d_sent_at IS 'DEPRECATED: replaced by reminder_0d_sent_at on 2026-11-21; retained for historical v1 rows.';
COMMENT ON COLUMN public.demo_contacts.final_email_claimed_at IS 'One final-notice attempt for consent 2026-11-21.v2; claimed rows survive demo_purge_pair until sent/failed, then are deleted.';

CREATE OR REPLACE FUNCTION public.demo_pair_deletes_at(_pair_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    (
      (
        greatest(
          greatest(dp.last_active_at, pt.last_active_at, ps.last_active_at)
            + make_interval(days => (SELECT inactive_days FROM public.demo_config LIMIT 1)),
          dp.extension_until
        ) AT TIME ZONE 'Europe/Prague'
      )::date + 1
    )::timestamp AT TIME ZONE 'Europe/Prague'
  )
  FROM public.demo_pairs dp
  LEFT JOIN public.profiles pt ON pt.id = dp.teacher_user_id
  LEFT JOIN public.profiles ps ON ps.id = dp.student_user_id
  WHERE dp.id = _pair_id
$$;
REVOKE EXECUTE ON FUNCTION public.demo_pair_deletes_at(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_pair_deletes_at(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_demo_expiry()
RETURNS TABLE(deletes_at timestamptz, days_left integer, extended boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT x.d,
         greatest(0, ((x.d AT TIME ZONE 'Europe/Prague')::date - 1) - (now() AT TIME ZONE 'Europe/Prague')::date)::integer,
         (dp.extended_at IS NOT NULL)
  FROM public.demo_pairs dp
  CROSS JOIN LATERAL (SELECT public.demo_pair_deletes_at(dp.id) AS d) x
  WHERE dp.id = public.demo_my_pair_id()
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_demo_expiry() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_demo_expiry() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.demo_cleanup_candidates()
RETURNS TABLE(pair_id uuid, teacher_user_id uuid, student_user_id uuid, last_active timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT dp.id, dp.teacher_user_id, dp.student_user_id,
         greatest(dp.last_active_at, pt.last_active_at, ps.last_active_at) AS la
  FROM public.demo_pairs dp
  LEFT JOIN public.profiles pt ON pt.id = dp.teacher_user_id
  LEFT JOIN public.profiles ps ON ps.id = dp.student_user_id
  WHERE public.demo_pair_deletes_at(dp.id) <= now()
    AND public.is_demo_user(dp.teacher_user_id)
    AND public.is_demo_user(dp.student_user_id)
  ORDER BY la
  LIMIT (SELECT cleanup_batch FROM public.demo_config LIMIT 1)
$function$;
REVOKE EXECUTE ON FUNCTION public.demo_cleanup_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_cleanup_candidates() TO service_role;

CREATE OR REPLACE FUNCTION public.demo_claim_reminders(_limit integer)
RETURNS TABLE(pair_id uuid, email text, kind text, deletes_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.demo_contacts c
     SET reminder_3d_sent_at = NULL, reminder_1d_sent_at = NULL, reminder_0d_sent_at = NULL,
         reminder_deadline_at = NULL, updated_at = now()
   WHERE c.reminder_deadline_at IS NOT NULL
     AND public.demo_pair_deletes_at(c.pair_id) > c.reminder_deadline_at + interval '12 hours';

  RETURN QUERY
  WITH due AS (
    SELECT c.pair_id AS pid, c.email AS em, public.demo_pair_deletes_at(c.pair_id) AS d,
           ((public.demo_pair_deletes_at(c.pair_id) AT TIME ZONE 'Europe/Prague')::date - 1) AS delete_day,
           c.reminder_0d_sent_at AS r0, c.reminder_3d_sent_at AS r3
    FROM public.demo_contacts c
  ), pick AS (
    SELECT due.pid, due.em, due.d,
      CASE
        WHEN due.delete_day = (now() AT TIME ZONE 'Europe/Prague')::date AND due.r0 IS NULL THEN '0d'
        WHEN due.delete_day > (now() AT TIME ZONE 'Europe/Prague')::date
         AND due.delete_day <= (now() AT TIME ZONE 'Europe/Prague')::date + 3
         AND due.r3 IS NULL AND due.r0 IS NULL THEN '3d'
      END AS k
    FROM due
  ), lim AS (
    SELECT * FROM pick WHERE pick.k IS NOT NULL
    ORDER BY (pick.k = '0d') DESC, pick.d
    LIMIT greatest(0, _limit)
  ), upd AS (
    UPDATE public.demo_contacts c
       SET reminder_0d_sent_at = CASE WHEN lim.k = '0d' THEN now() ELSE c.reminder_0d_sent_at END,
           reminder_3d_sent_at = CASE WHEN lim.k IN ('0d', '3d') THEN coalesce(c.reminder_3d_sent_at, now()) ELSE c.reminder_3d_sent_at END,
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
     SET reminder_0d_sent_at = CASE WHEN _kind = '0d' THEN NULL ELSE reminder_0d_sent_at END,
         reminder_1d_sent_at = CASE WHEN _kind = '1d' THEN NULL ELSE reminder_1d_sent_at END,
         reminder_3d_sent_at = CASE WHEN _had_3d THEN reminder_3d_sent_at ELSE NULL END,
         updated_at = now()
    WHERE pair_id = _pair_id
$$;
REVOKE EXECUTE ON FUNCTION public.demo_release_reminder(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_release_reminder(uuid, text, boolean) TO service_role;

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
     SET reminder_3d_sent_at = NULL, reminder_1d_sent_at = NULL, reminder_0d_sent_at = NULL,
         reminder_deadline_at = NULL, updated_at = now()
   WHERE pair_id = pid;
  RETURN public.demo_pair_deletes_at(pid);
END $$;
REVOKE EXECUTE ON FUNCTION public.demo_extend_once() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demo_extend_once() TO authenticated;

CREATE OR REPLACE FUNCTION public.demo_claim_final_email(_pair_id uuid)
RETURNS TABLE(pair_id uuid, email text, final_email_claimed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE public.demo_contacts c
     SET final_email_claimed_at = now(), updated_at = now()
   WHERE c.pair_id = _pair_id
     AND c.consent_version = '2026-11-21.v2'
     AND c.final_email_claimed_at IS NULL
     AND public.demo_pair_deletes_at(c.pair_id) <= now()
     AND EXISTS (
       SELECT 1 FROM public.demo_pairs dp
       WHERE dp.id = c.pair_id
         AND public.is_demo_user(dp.teacher_user_id)
         AND public.is_demo_user(dp.student_user_id)
         AND NOT EXISTS (
           SELECT 1 FROM public.demo_shared_users ds
           WHERE ds.user_id IN (dp.teacher_user_id, dp.student_user_id)
         )
     )
  RETURNING c.pair_id, c.email, c.final_email_claimed_at;
END $$;
REVOKE EXECUTE ON FUNCTION public.demo_claim_final_email(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_claim_final_email(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.demo_release_final_email(_pair_id uuid, _claimed_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.demo_contacts
     SET final_email_claimed_at = NULL, updated_at = now()
   WHERE pair_id = _pair_id AND final_email_claimed_at = _claimed_at
$$;
REVOKE EXECUTE ON FUNCTION public.demo_release_final_email(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_release_final_email(uuid, timestamptz) TO service_role;

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

  -- Rezervovaný kontakt v2 přežije jen do odeslání/selhání závěrečné zprávy; v1 se smaže bez ní.
  DELETE FROM public.demo_contacts WHERE pair_id = _pair_id AND final_email_claimed_at IS NULL;
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

NOTIFY pgrst, 'reload schema';