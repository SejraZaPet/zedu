CREATE TABLE public.assignment_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX assignment_comments_assignment_created_idx ON public.assignment_comments (assignment_id, created_at);
CREATE INDEX assignment_comments_author_idx ON public.assignment_comments (author_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_comments TO authenticated;
GRANT ALL ON public.assignment_comments TO service_role;
ALTER TABLE public.assignment_comments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_moderate_assignment_comments(_assignment_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = _assignment_id
    AND (a.teacher_id = _uid OR (a.class_id IS NOT NULL AND public.is_class_teacher(a.class_id, _uid))))
  OR (_uid = auth.uid() AND public.is_admin())
$$;

-- rodič (bez učitelské role) komentáře nevidí ani nepíše
CREATE OR REPLACE FUNCTION public.is_parent_only(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role = 'rodic')
    AND NOT public.is_teaching_staff(_uid)
$$;

-- komentáře povolené: settings.commentsEnabled, jinak výchozí podle druhu (úkol = vypnuto)
CREATE OR REPLACE FUNCTION public.assignment_comments_enabled(_assignment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    CASE WHEN jsonb_typeof(a.settings->'commentsEnabled') = 'boolean' THEN (a.settings->>'commentsEnabled')::boolean END,
    COALESCE(a.settings->>'kind', 'task') IN ('material', 'announcement'))
  FROM public.assignments a WHERE a.id = _assignment_id
$$;

CREATE POLICY ac_select ON public.assignment_comments FOR SELECT TO authenticated
  USING (NOT public.is_parent_only(auth.uid())
    AND EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id));
CREATE POLICY ac_insert ON public.assignment_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND deleted_at IS NULL AND deleted_by IS NULL
    AND NOT public.is_parent_only(auth.uid())
    AND EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id)
    AND public.assignment_comments_enabled(assignment_id));
CREATE POLICY ac_update ON public.assignment_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.can_moderate_assignment_comments(assignment_id, auth.uid()))
  WITH CHECK (author_id = auth.uid() OR public.can_moderate_assignment_comments(assignment_id, auth.uid()));
CREATE POLICY ac_delete ON public.assignment_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.can_moderate_assignment_comments(assignment_id, auth.uid()));

CREATE POLICY demo_iso ON public.assignment_comments AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR public.demo_can_see_assignment(assignment_id))
  WITH CHECK (NOT public.is_demo_user(auth.uid()) OR public.demo_can_see_assignment(assignment_id));

CREATE OR REPLACE FUNCTION public.assignment_comments_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (SELECT count(*) FROM public.assignment_comments c
      WHERE c.author_id = auth.uid() AND c.created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'comment_rate_limit' USING HINT = 'Max 30 komentářů za hodinu.';
  END IF;
  NEW.created_at := now(); NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER assignment_comments_before_insert BEFORE INSERT ON public.assignment_comments
  FOR EACH ROW EXECUTE FUNCTION public.assignment_comments_before_insert();

CREATE OR REPLACE FUNCTION public.assignment_comments_before_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NEW.id <> OLD.id OR NEW.assignment_id <> OLD.assignment_id OR NEW.author_id <> OLD.author_id
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'comment_immutable_fields';
  END IF;
  NEW.updated_at := now();
  IF _uid IS NULL THEN RETURN NEW; END IF;
  IF _uid = OLD.author_id AND NOT public.can_moderate_assignment_comments(OLD.assignment_id, _uid) THEN
    IF OLD.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'comment_deleted'; END IF;
    IF NEW.body IS DISTINCT FROM OLD.body THEN
      IF EXISTS (SELECT 1 FROM public.assignment_comments c WHERE c.assignment_id = OLD.assignment_id
          AND c.author_id <> OLD.author_id AND c.created_at > OLD.created_at) THEN
        RAISE EXCEPTION 'comment_edit_locked' USING HINT = 'Pod komentářem už je novější odpověď.';
      END IF;
    END IF;
    IF NEW.deleted_at IS NOT NULL THEN NEW.deleted_by := _uid; ELSE NEW.deleted_by := NULL; END IF;
  ELSIF _uid <> OLD.author_id THEN
    -- moderátor: smí jen skrýt/obnovit, text cizího komentáře nemění
    IF NEW.body IS DISTINCT FROM OLD.body THEN RAISE EXCEPTION 'comment_moderator_cannot_edit'; END IF;
    IF NEW.deleted_at IS NOT NULL THEN NEW.deleted_by := _uid; ELSE NEW.deleted_by := NULL; END IF;
  ELSE
    -- autor, který je zároveň moderátor
    IF NEW.deleted_at IS NOT NULL THEN NEW.deleted_by := COALESCE(NEW.deleted_by, _uid); ELSE NEW.deleted_by := NULL; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assignment_comments_before_update BEFORE UPDATE ON public.assignment_comments
  FOR EACH ROW EXECUTE FUNCTION public.assignment_comments_before_update();

REVOKE EXECUTE ON FUNCTION public.assignment_comments_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assignment_comments_before_update() FROM PUBLIC, anon, authenticated;