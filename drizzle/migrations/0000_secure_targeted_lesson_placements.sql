ALTER TABLE public.lesson_placements
  ADD COLUMN IF NOT EXISTS subject_group_id uuid REFERENCES public.subject_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS school_term text NOT NULL DEFAULT 'full_year',
  ADD COLUMN IF NOT EXISTS scope_all_grades boolean NOT NULL DEFAULT false;

ALTER TABLE public.lesson_placements
  DROP CONSTRAINT IF EXISTS lesson_placements_school_term_check;

ALTER TABLE public.lesson_placements
  ADD CONSTRAINT lesson_placements_school_term_check
  CHECK (school_term IN ('full_year', 'first_half', 'second_half'));

ALTER TABLE public.lesson_placements
  DROP CONSTRAINT IF EXISTS lesson_placements_single_target_check;

ALTER TABLE public.lesson_placements
  ADD CONSTRAINT lesson_placements_single_target_check
  CHECK (NOT (class_id IS NOT NULL AND subject_group_id IS NOT NULL));

ALTER TABLE public.lesson_placements
  DROP CONSTRAINT IF EXISTS lesson_placements_lesson_id_subject_slug_grade_number_topic_key;

CREATE UNIQUE INDEX IF NOT EXISTS lesson_placements_unique_target
  ON public.lesson_placements (
    lesson_id,
    subject_slug,
    grade_number,
    topic_id,
    class_id,
    subject_group_id,
    school_term,
    scope_all_grades
  ) NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_lesson_placements_class_id
  ON public.lesson_placements (class_id)
  WHERE class_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_placements_subject_group_id
  ON public.lesson_placements (subject_group_id)
  WHERE subject_group_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.can_manage_lesson_placement(
  _lesson_id uuid,
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
        EXISTS (
          SELECT 1
          FROM public.teacher_textbook_lessons ttl
          WHERE ttl.id = _lesson_id
            AND public.owns_textbook(ttl.textbook_id, _user_id)
        )
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

CREATE OR REPLACE FUNCTION public.can_view_lesson_placement(
  _placement_id uuid,
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
    FROM public.lesson_placements lp
    JOIN public.teacher_textbook_lessons ttl ON ttl.id = lp.lesson_id
    WHERE lp.id = _placement_id
      AND _user_id IS NOT NULL
      AND lp.status = 'published'
      AND (
        public.is_admin()
        OR public.owns_textbook(ttl.textbook_id, _user_id)
        OR (
          public.can_access_textbooks(_user_id)
          AND (
            public.is_enrolled_in_textbook(ttl.textbook_id, _user_id)
            OR public.is_class_linked_textbook(ttl.textbook_id, _user_id)
            OR public.is_direct_shared_textbook(ttl.textbook_id, _user_id)
          )
          AND (
            (lp.class_id IS NOT NULL AND EXISTS (
              SELECT 1
              FROM public.class_members cm
              WHERE cm.class_id = lp.class_id
                AND cm.user_id = _user_id
            ))
            OR (lp.subject_group_id IS NOT NULL AND EXISTS (
              SELECT 1
              FROM public.subject_group_members sgm
              WHERE sgm.group_id = lp.subject_group_id
                AND sgm.student_id = _user_id
            ))
            OR (lp.class_id IS NULL AND lp.subject_group_id IS NULL)
          )
          AND (
            lp.scope_all_grades
            OR EXISTS (
              SELECT 1
              FROM public.class_members cm
              JOIN public.classes c ON c.id = cm.class_id
              WHERE cm.user_id = _user_id
                AND c.year = lp.grade_number
            )
            OR EXISTS (
              SELECT 1
              FROM public.profiles p
              WHERE p.id = _user_id
                AND p.year = lp.grade_number
            )
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_teacher_textbook_lesson(
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
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_textbook_lessons ttl
    WHERE ttl.id = _lesson_id
      AND _user_id IS NOT NULL
      AND (
        public.is_admin()
        OR public.owns_textbook(ttl.textbook_id, _user_id)
        OR (
          (
            public.is_enrolled_in_textbook(ttl.textbook_id, _user_id)
            OR public.is_class_linked_textbook(ttl.textbook_id, _user_id)
            OR public.is_direct_shared_textbook(ttl.textbook_id, _user_id)
          )
          AND (
            NOT EXISTS (
              SELECT 1
              FROM public.lesson_placements any_lp
              WHERE any_lp.lesson_id = ttl.id
            )
            OR EXISTS (
              SELECT 1
              FROM public.lesson_placements visible_lp
              WHERE visible_lp.lesson_id = ttl.id
                AND public.can_view_lesson_placement(visible_lp.id, _user_id)
            )
          )
        )
      )
  );
$$;

DROP POLICY IF EXISTS "Approved users can read lesson_placements" ON public.lesson_placements;
DROP POLICY IF EXISTS "Teacher can manage own lesson_placements" ON public.lesson_placements;
DROP POLICY IF EXISTS "Admin can manage lesson_placements" ON public.lesson_placements;

CREATE POLICY "Placement managers can read lesson placements"
ON public.lesson_placements FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.can_manage_lesson_placement(lesson_id, class_id, subject_group_id, auth.uid())
);

CREATE POLICY "Eligible students can read lesson placements"
ON public.lesson_placements FOR SELECT TO authenticated
USING (public.can_view_lesson_placement(id, auth.uid()));

CREATE POLICY "Placement managers can insert lesson placements"
ON public.lesson_placements FOR INSERT TO authenticated
WITH CHECK (public.can_manage_lesson_placement(lesson_id, class_id, subject_group_id, auth.uid()));

CREATE POLICY "Placement managers can update lesson placements"
ON public.lesson_placements FOR UPDATE TO authenticated
USING (public.can_manage_lesson_placement(lesson_id, class_id, subject_group_id, auth.uid()))
WITH CHECK (public.can_manage_lesson_placement(lesson_id, class_id, subject_group_id, auth.uid()));

CREATE POLICY "Placement managers can delete lesson placements"
ON public.lesson_placements FOR DELETE TO authenticated
USING (public.can_manage_lesson_placement(lesson_id, class_id, subject_group_id, auth.uid()));

DROP POLICY IF EXISTS "Enrolled students can read lessons" ON public.teacher_textbook_lessons;
DROP POLICY IF EXISTS "Shared recipients can view textbook lessons" ON public.teacher_textbook_lessons;
DROP POLICY IF EXISTS "Students can read class-linked teacher textbook lessons" ON public.teacher_textbook_lessons;

CREATE POLICY "Eligible students can read teacher textbook lessons"
ON public.teacher_textbook_lessons FOR SELECT TO authenticated
USING (public.can_view_teacher_textbook_lesson(id, auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_placements TO authenticated;
GRANT ALL ON public.lesson_placements TO service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_lesson_placement(uuid, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_lesson_placement(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_teacher_textbook_lesson(uuid, uuid) TO authenticated, service_role;