
CREATE TABLE public.demo_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  ai_per_account int NOT NULL DEFAULT 5,
  ai_daily_global int NOT NULL DEFAULT 150,
  upload_max_bytes bigint NOT NULL DEFAULT 2097152,
  upload_max_files int NOT NULL DEFAULT 20,
  inactive_days int NOT NULL DEFAULT 14,
  cleanup_batch int NOT NULL DEFAULT 50
);
GRANT ALL ON public.demo_config TO service_role;
ALTER TABLE public.demo_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.demo_config DEFAULT VALUES;

CREATE TABLE public.demo_ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX demo_ai_usage_user_idx ON public.demo_ai_usage(user_id);
CREATE INDEX demo_ai_usage_created_idx ON public.demo_ai_usage(created_at);
GRANT ALL ON public.demo_ai_usage TO service_role;
ALTER TABLE public.demo_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.demo_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at timestamptz NOT NULL DEFAULT now(),
  pairs_deleted int NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT ALL ON public.demo_cleanup_log TO service_role;
ALTER TABLE public.demo_cleanup_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.demo_seed_snapshot (
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  data jsonb NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, row_id)
);
GRANT ALL ON public.demo_seed_snapshot TO service_role;
ALTER TABLE public.demo_seed_snapshot ENABLE ROW LEVEL SECURITY;

INSERT INTO public.demo_seed_snapshot(table_name,row_id,data)
SELECT 'worksheets', id, to_jsonb(w) FROM public.worksheets w WHERE is_demo_seed
UNION ALL SELECT 'teacher_presentations', id, to_jsonb(p) FROM public.teacher_presentations p WHERE is_demo_seed
UNION ALL SELECT 'teacher_textbooks', id, to_jsonb(t) FROM public.teacher_textbooks t WHERE is_demo_seed
UNION ALL SELECT 'teacher_textbook_lessons', l.id, to_jsonb(l) FROM public.teacher_textbook_lessons l
  WHERE l.textbook_id IN (SELECT id FROM public.teacher_textbooks WHERE is_demo_seed);

-- AI limit: atomická rezervace (advisory lock), ne-demo vždy true bez zápisu
CREATE OR REPLACE FUNCTION public.demo_ai_reserve(_user_id uuid, _fn text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.demo_config;
BEGIN
  IF NOT public.is_demo_user(_user_id) THEN RETURN true; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('demo_ai_usage'));
  SELECT * INTO c FROM public.demo_config LIMIT 1;
  IF (SELECT count(*) FROM public.demo_ai_usage WHERE user_id = _user_id) >= c.ai_per_account THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.demo_ai_usage WHERE created_at >= date_trunc('day', now())) >= c.ai_daily_global THEN RETURN false; END IF;
  INSERT INTO public.demo_ai_usage(user_id, function_name) VALUES (_user_id, left(coalesce(_fn,''),80));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.demo_ai_reserve(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_ai_reserve(uuid, text) TO service_role;

-- Storage limit
CREATE OR REPLACE FUNCTION public.demo_storage_upload_ok(_name text, _metadata jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE c public.demo_config; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.is_demo_user(uid) THEN RETURN true; END IF;
  SELECT * INTO c FROM public.demo_config LIMIT 1;
  IF lower(coalesce(_name,'')) !~ '\.(png|jpe?g|webp|pdf|docx|pptx|xlsx)$' THEN RETURN false; END IF;
  IF coalesce((_metadata->>'size')::bigint, (_metadata->>'contentLength')::bigint, 0) > c.upload_max_bytes THEN RETURN false; END IF;
  IF coalesce(_metadata->>'mimetype','') ~* '^(video|audio)/' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM storage.objects o WHERE o.owner = uid OR o.owner_id = uid::text) >= c.upload_max_files THEN RETURN false; END IF;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.demo_storage_upload_ok(text, jsonb) TO authenticated, anon, service_role;

CREATE POLICY demo_guard_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.demo_storage_upload_ok(name, metadata));
CREATE POLICY demo_guard_upload_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true) WITH CHECK (public.demo_storage_upload_ok(name, metadata));

-- Zákazy změn účtu
CREATE OR REPLACE FUNCTION public.demo_guard_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.is_demo_user(uid) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'V testovacím účtu nelze měnit.' USING ERRCODE = '42501'; END IF;
  IF OLD.id <> uid THEN RAISE EXCEPTION 'V testovacím účtu nelze měnit.' USING ERRCODE = '42501'; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.school IS DISTINCT FROM OLD.school OR NEW.school_id IS DISTINCT FROM OLD.school_id
     OR NEW.status IS DISTINCT FROM OLD.status OR NEW.username IS DISTINCT FROM OLD.username
     OR NEW.student_code IS DISTINCT FROM OLD.student_code OR NEW.parent_email IS DISTINCT FROM OLD.parent_email
     OR NEW.email_notifications_enabled IS DISTINCT FROM OLD.email_notifications_enabled
     OR NEW.parent_email_notifications IS DISTINCT FROM OLD.parent_email_notifications THEN
    RAISE EXCEPTION 'V testovacím účtu nelze měnit.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER demo_guard_profile BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.demo_guard_profile();

CREATE POLICY demo_guard_insert ON public.user_roles AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_user(auth.uid()));
CREATE POLICY demo_guard_update ON public.user_roles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()));
CREATE POLICY demo_guard_delete ON public.user_roles AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()));
CREATE POLICY demo_guard_insert ON public.school_join_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_user(auth.uid()));

-- Úklid
CREATE OR REPLACE FUNCTION public.demo_cleanup_candidates()
RETURNS TABLE(pair_id uuid, teacher_user_id uuid, student_user_id uuid, last_active timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT dp.id, dp.teacher_user_id, dp.student_user_id,
         greatest(dp.last_active_at, pt.last_active_at, ps.last_active_at) AS la
  FROM public.demo_pairs dp
  LEFT JOIN public.profiles pt ON pt.id = dp.teacher_user_id
  LEFT JOIN public.profiles ps ON ps.id = dp.student_user_id
  WHERE greatest(dp.last_active_at, pt.last_active_at, ps.last_active_at)
        < now() - make_interval(days => (SELECT inactive_days FROM public.demo_config LIMIT 1))
  ORDER BY la
  LIMIT (SELECT cleanup_batch FROM public.demo_config LIMIT 1)
$$;
REVOKE ALL ON FUNCTION public.demo_cleanup_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_cleanup_candidates() TO service_role;

CREATE OR REPLACE FUNCTION public.demo_pair_storage_objects(_pair_id uuid)
RETURNS TABLE(bucket_id text, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
  SELECT o.bucket_id, o.name FROM storage.objects o, public.demo_pairs dp
  WHERE dp.id = _pair_id
    AND (o.owner IN (dp.teacher_user_id, dp.student_user_id)
         OR o.owner_id IN (dp.teacher_user_id::text, dp.student_user_id::text))
$$;
REVOKE ALL ON FUNCTION public.demo_pair_storage_objects(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_pair_storage_objects(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.demo_purge_pair(_pair_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.demo_purge_pair(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_purge_pair(uuid) TO service_role;

-- Ruční reset ukázek ze snímku
CREATE OR REPLACE FUNCTION public.demo_reset_seed()
RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; cols text; cnt int := 0; n int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  FOR s IN SELECT * FROM public.demo_seed_snapshot ORDER BY
      CASE table_name WHEN 'teacher_textbooks' THEN 1 WHEN 'teacher_textbook_lessons' THEN 2 ELSE 3 END LOOP
    SELECT string_agg(format('%I', column_name), ',') INTO cols
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=s.table_name AND column_name <> 'id'
        AND is_generated = 'NEVER';
    EXECUTE format('UPDATE public.%I t SET (%s) = (SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1)) WHERE t.id = $2',
                   s.table_name, cols, cols, s.table_name) USING s.data, s.row_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN
      EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)', s.table_name, s.table_name) USING s.data;
    END IF;
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END $$;
REVOKE ALL ON FUNCTION public.demo_reset_seed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demo_reset_seed() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
