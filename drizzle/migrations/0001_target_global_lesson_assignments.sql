ALTER TABLE public.lesson_topic_assignments
  ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS subject_group_id uuid REFERENCES public.subject_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS school_term text NOT NULL DEFAULT 'full_year',
  ADD COLUMN IF NOT EXISTS scope_all_grades boolean NOT NULL DEFAULT false;

ALTER TABLE public.lesson_topic_assignments
  DROP CONSTRAINT IF EXISTS lesson_topic_assignments_lesson_id_topic_id_key;

ALTER TABLE public.lesson_topic_assignments
  DROP CONSTRAINT IF EXISTS lesson_topic_assignments_one_target_check;
ALTER TABLE public.lesson_topic_assignments
  ADD CONSTRAINT lesson_topic_assignments_one_target_check
  CHECK (NOT (class_id IS NOT NULL AND subject_group_id IS NOT NULL));

ALTER TABLE public.lesson_topic_assignments
  DROP CONSTRAINT IF EXISTS lesson_topic_assignments_school_term_check;
ALTER TABLE public.lesson_topic_assignments
  ADD CONSTRAINT lesson_topic_assignments_school_term_check
  CHECK (school_term IN ('full_year', 'first_half', 'second_half'));

CREATE UNIQUE INDEX IF NOT EXISTS lesson_topic_assignments_unique_target
  ON public.lesson_topic_assignments (
    lesson_id,
    topic_id,
    COALESCE(class_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(subject_group_id, '00000000-0000-0000-0000-000000000000'::uuid),
    school_term,
    scope_all_grades
  );

CREATE INDEX IF NOT EXISTS idx_lta_class_id
  ON public.lesson_topic_assignments(class_id)
  WHERE class_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lta_subject_group_id
  ON public.lesson_topic_assignments(subject_group_id)
  WHERE subject_group_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.can_manage_lesson_topic_assignment(
  _class_id uuid DEFAULT NULL,
  _subject_group_id uuid DEFAULT NULL,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    _user_id IS NOT NULL
    AND NOT (_class_id IS NOT NULL AND _subject_group_id IS NOT NULL)
    AND (
      public.is_admin()
      OR (
        public.is_admin_or_teacher()
        AND (
          _class_id IS NULL
          OR public.is_class_teacher(_class_id, _user_id)
          OR public.is_class_owner(_class_id, _user_id)
        )
        AND (
          _subject_group_id IS NULL
          OR public.owns_subject_group(_subject_group_id, _user_id)
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_lesson_topic_assignment(
  _assignment_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lesson_topic_assignments lta
    JOIN public.textbook_topics tt ON tt.id = lta.topic_id
    WHERE lta.id = _assignment_id
      AND _user_id IS NOT NULL
      AND lta.status = 'published'
      AND (
        public.is_admin_or_teacher()
        OR (
          public.can_access_textbooks(_user_id)
          AND (
            (lta.class_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.class_members cm
              WHERE cm.class_id = lta.class_id AND cm.user_id = _user_id
            ))
            OR (lta.subject_group_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.subject_group_members sgm
              WHERE sgm.group_id = lta.subject_group_id AND sgm.student_id = _user_id
            ))
            OR (lta.class_id IS NULL AND lta.subject_group_id IS NULL)
          )
          AND (
            lta.scope_all_grades
            OR EXISTS (
              SELECT 1 FROM public.class_members cm
              JOIN public.classes c ON c.id = cm.class_id
              WHERE cm.user_id = _user_id AND c.year = tt.grade
            )
            OR EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = _user_id AND p.year = tt.grade
            )
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_textbook_lesson(
  _lesson_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.is_admin_or_teacher()
      OR (
        public.can_access_textbooks(_user_id)
        AND EXISTS (
          SELECT 1
          FROM public.lesson_topic_assignments lta
          WHERE lta.lesson_id = _lesson_id
            AND public.can_view_lesson_topic_assignment(lta.id, _user_id)
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_lesson_topic_assignment(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_lesson_topic_assignment(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_textbook_lesson(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_lesson_topic_assignment(uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_lesson_topic_assignment(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_textbook_lesson(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Approved users can read lesson_topic_assignments" ON public.lesson_topic_assignments;
DROP POLICY IF EXISTS "Admin can insert lesson_topic_assignments" ON public.lesson_topic_assignments;
DROP POLICY IF EXISTS "Admin can update lesson_topic_assignments" ON public.lesson_topic_assignments;
DROP POLICY IF EXISTS "Admin can delete lesson_topic_assignments" ON public.lesson_topic_assignments;
DROP POLICY IF EXISTS "Teacher can insert lesson_topic_assignments" ON public.lesson_topic_assignments;
DROP POLICY IF EXISTS "Teacher can update lesson_topic_assignments" ON public.lesson_topic_assignments;
DROP POLICY IF EXISTS "Teacher can delete lesson_topic_assignments" ON public.lesson_topic_assignments;

CREATE POLICY "Authorized users can read lesson topic assignments"
  ON public.lesson_topic_assignments FOR SELECT TO authenticated
  USING (
    public.can_manage_lesson_topic_assignment(class_id, subject_group_id, auth.uid())
    OR public.can_view_lesson_topic_assignment(id, auth.uid())
  );
CREATE POLICY "Authorized teachers can insert lesson topic assignments"
  ON public.lesson_topic_assignments FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_lesson_topic_assignment(class_id, subject_group_id, auth.uid()));
CREATE POLICY "Authorized teachers can update lesson topic assignments"
  ON public.lesson_topic_assignments FOR UPDATE TO authenticated
  USING (public.can_manage_lesson_topic_assignment(class_id, subject_group_id, auth.uid()))
  WITH CHECK (public.can_manage_lesson_topic_assignment(class_id, subject_group_id, auth.uid()));
CREATE POLICY "Authorized teachers can delete lesson topic assignments"
  ON public.lesson_topic_assignments FOR DELETE TO authenticated
  USING (public.can_manage_lesson_topic_assignment(class_id, subject_group_id, auth.uid()));

DROP POLICY IF EXISTS "Approved users can read textbook_lessons" ON public.textbook_lessons;
CREATE POLICY "Authorized users can read textbook lessons"
  ON public.textbook_lessons FOR SELECT TO authenticated
  USING (public.can_view_textbook_lesson(id, auth.uid()));