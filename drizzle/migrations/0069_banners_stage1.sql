CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('platform','school')),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  image_path text, video_path text, poster_path text,
  alt_text text NOT NULL CHECK (length(btrim(alt_text)) BETWEEN 3 AND 200),
  link_url text CHECK (link_url IS NULL OR link_url ~ '^https://[^\s]+$'),
  target_students boolean NOT NULL DEFAULT false,
  target_teachers boolean NOT NULL DEFAULT false,
  target_leadership boolean NOT NULL DEFAULT false,
  display_seconds int NOT NULL DEFAULT 6 CHECK (display_seconds BETWEEN 3 AND 60),
  starts_at timestamptz, ends_at timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  hidden_by_admin boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope='platform' AND school_id IS NULL) OR (scope='school' AND school_id IS NOT NULL)),
  CHECK (target_students OR target_teachers OR target_leadership),
  CHECK ((media_type='image' AND image_path IS NOT NULL)
      OR (media_type='video' AND video_path IS NOT NULL AND poster_path IS NOT NULL)),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX banners_scope_school_idx ON public.banners (scope, school_id) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY banners_admin_all ON public.banners FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY banners_school_admin_select ON public.banners FOR SELECT TO authenticated
  USING (scope='school' AND public.is_school_admin(auth.uid())
         AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY banners_school_admin_insert ON public.banners FOR INSERT TO authenticated
  WITH CHECK (scope='school' AND public.is_school_admin(auth.uid())
              AND school_id = public.get_user_school_id(auth.uid()) AND hidden_by_admin = false);
CREATE POLICY banners_school_admin_update ON public.banners FOR UPDATE TO authenticated
  USING (scope='school' AND public.is_school_admin(auth.uid())
         AND school_id = public.get_user_school_id(auth.uid()))
  WITH CHECK (scope='school' AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY banners_school_admin_delete ON public.banners FOR DELETE TO authenticated
  USING (scope='school' AND public.is_school_admin(auth.uid())
         AND school_id = public.get_user_school_id(auth.uid()));
-- Demo: jen čtení (doplňkově, nic neoslabuje)
CREATE POLICY demo_guard_banners_write ON public.banners AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_user(auth.uid()));
CREATE POLICY demo_guard_banners_update ON public.banners AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()));
CREATE POLICY demo_guard_banners_delete ON public.banners AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()));

-- Pojistka: limit 3 aktivní na skupinu (platforma) / školu; školní admin nesmí měnit hidden_by_admin
CREATE OR REPLACE FUNCTION public.tg_banners_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT public.is_admin() THEN
    IF TG_OP='UPDATE' AND NEW.hidden_by_admin IS DISTINCT FROM OLD.hidden_by_admin THEN
      RAISE EXCEPTION 'Skrytí banneru smí měnit jen správce platformy';
    END IF;
    IF TG_OP='UPDATE' AND (NEW.scope<>OLD.scope OR NEW.school_id IS DISTINCT FROM OLD.school_id) THEN
      RAISE EXCEPTION 'Banner nelze přesunout do jiné školy';
    END IF;
  ELSIF TG_OP='UPDATE' AND OLD.scope='school' AND auth.uid() IS NOT NULL
        AND (to_jsonb(NEW) - 'hidden_by_admin' - 'updated_at') <> (to_jsonb(OLD) - 'hidden_by_admin' - 'updated_at') THEN
    RAISE EXCEPTION 'Školní banner smí správce platformy jen skrýt';
  END IF;
  NEW.updated_at := now();
  IF NEW.is_active AND (NEW.ends_at IS NULL OR NEW.ends_at > now()) THEN
    PERFORM pg_advisory_xact_lock(hashtext('banners:'||NEW.scope||':'||coalesce(NEW.school_id::text,'-')));
    IF NEW.scope='school' THEN
      SELECT count(*) INTO n FROM public.banners
       WHERE scope='school' AND school_id=NEW.school_id AND is_active AND NOT hidden_by_admin
         AND (ends_at IS NULL OR ends_at > now()) AND id <> NEW.id;
      IF n >= 3 THEN RAISE EXCEPTION 'Škola může mít nejvýš 3 aktivní bannery'; END IF;
    ELSE
      IF NEW.target_students AND (SELECT count(*) FROM public.banners WHERE scope='platform' AND is_active
           AND target_students AND (ends_at IS NULL OR ends_at>now()) AND id<>NEW.id) >= 3
        THEN RAISE EXCEPTION 'Žáci mohou mít nejvýš 3 aktivní platformové bannery'; END IF;
      IF NEW.target_teachers AND (SELECT count(*) FROM public.banners WHERE scope='platform' AND is_active
           AND target_teachers AND (ends_at IS NULL OR ends_at>now()) AND id<>NEW.id) >= 3
        THEN RAISE EXCEPTION 'Učitelé mohou mít nejvýš 3 aktivní platformové bannery'; END IF;
      IF NEW.target_leadership AND (SELECT count(*) FROM public.banners WHERE scope='platform' AND is_active
           AND target_leadership AND (ends_at IS NULL OR ends_at>now()) AND id<>NEW.id) >= 3
        THEN RAISE EXCEPTION 'Vedení může mít nejvýš 3 aktivní platformové bannery'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER banners_guard BEFORE INSERT OR UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.tg_banners_guard();

-- Čtení pro běžné uživatele jen přes RPC (tabulku přímo nečtou)
CREATE OR REPLACE FUNCTION public.get_my_banners()
RETURNS SETOF public.banners LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT public.get_user_school_id(auth.uid()) AS school_id,
      EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='school_admin') AS lead,
      EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role IN ('teacher','lektor')) AS teach,
      EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='user') AS stud
  ), live AS (
    SELECT b.*, row_number() OVER (PARTITION BY b.scope ORDER BY b.sort_order, b.created_at) rn
    FROM banners b, me
    WHERE auth.uid() IS NOT NULL AND b.is_active AND NOT b.hidden_by_admin
      AND (b.starts_at IS NULL OR b.starts_at <= now()) AND (b.ends_at IS NULL OR b.ends_at > now())
      AND (b.scope='platform' OR b.school_id = me.school_id)
      AND ((me.lead AND b.target_leadership) OR (me.teach AND b.target_teachers) OR (me.stud AND b.target_students))
  )
  SELECT id, scope, school_id, media_type, image_path, video_path, poster_path, alt_text, link_url,
         target_students, target_teachers, target_leadership, display_seconds, starts_at, ends_at,
         sort_order, is_active, hidden_by_admin, created_by, created_at, updated_at
  FROM live ORDER BY rn, (scope='school') LIMIT 6
$$;
REVOKE ALL ON FUNCTION public.get_my_banners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_banners() TO authenticated;
REVOKE ALL ON FUNCTION public.tg_banners_guard() FROM PUBLIC, anon;

-- Úložiště (bucket `banners` založen nástrojem, ne SQL): zápis do platform/* jen admin,
-- do school/<school_id>/* jen správce té školy; čtení veřejné.
CREATE POLICY banners_obj_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='banners' AND NOT public.is_demo_user(auth.uid()) AND (
    (public.is_admin() AND (storage.foldername(name))[1] IN ('platform','school'))
    OR ((storage.foldername(name))[1]='school' AND public.is_school_admin(auth.uid())
        AND (storage.foldername(name))[2] = public.get_user_school_id(auth.uid())::text)));
CREATE POLICY banners_obj_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id='banners' AND (public.is_admin()
    OR ((storage.foldername(name))[1]='school' AND public.is_school_admin(auth.uid())
        AND (storage.foldername(name))[2] = public.get_user_school_id(auth.uid())::text)));