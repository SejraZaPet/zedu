-- Fáze 1A: Zabezpečení XP, známek a studijní aktivity
-- 1) is_teacher_of_student(_student_id, _user_id) rozšířená i o skupiny (subject_group_members)
CREATE OR REPLACE FUNCTION public.is_teacher_of_student(_student_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_members cm
    JOIN public.class_teachers ct ON ct.class_id = cm.class_id
    WHERE cm.user_id = _student_id AND ct.user_id = _user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.subject_group_members sgm
    JOIN public.subject_groups sg ON sg.id = sgm.group_id
    WHERE sgm.student_id = _student_id AND sg.created_by = _user_id
  )
$$;

-- 2) student_xp: žák nesmí vkládat ani upravovat vlastní řádek; čte jen svůj.
DROP POLICY IF EXISTS "Students insert own XP" ON public.student_xp;
DROP POLICY IF EXISTS "Students update own XP" ON public.student_xp;
DROP POLICY IF EXISTS "Students view own XP" ON public.student_xp;

CREATE POLICY "Students view own XP"
ON public.student_xp FOR SELECT
TO authenticated
USING (
  auth.uid() = student_id
  OR is_admin()
  OR is_teacher_of_student(student_id, auth.uid())
);

CREATE POLICY "Admin manage student_xp"
ON public.student_xp FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 3) student_badges: učitel čte jen žáky svých tříd a skupin
DROP POLICY IF EXISTS "Students view own badges" ON public.student_badges;

CREATE POLICY "Students view own badges"
ON public.student_badges FOR SELECT
TO authenticated
USING (
  auth.uid() = student_id
  OR is_admin()
  OR is_teacher_of_student(student_id, auth.uid())
);

-- 4) student_activity_results: čtení pro učitele tříd a skupin žáka
CREATE POLICY "Teachers view activity results of their students"
ON public.student_activity_results FOR SELECT
TO authenticated
USING (is_teacher_of_student(user_id, auth.uid()));

-- 5) student_practice_sessions + student_lesson_mastery: učitel i přes skupiny
DROP POLICY IF EXISTS "Teachers view sessions of their class students" ON public.student_practice_sessions;
CREATE POLICY "Teachers view sessions of their students"
ON public.student_practice_sessions FOR SELECT
TO authenticated
USING (is_teacher_of_student(student_id, auth.uid()));

DROP POLICY IF EXISTS "Teachers view mastery of class students" ON public.student_lesson_mastery;
CREATE POLICY "Teachers view mastery of their students"
ON public.student_lesson_mastery FOR SELECT
TO authenticated
USING (is_teacher_of_student(student_id, auth.uid()));

-- 6) XP za odevzdání úkolu: jednou, při prvním odevzdání (submitted_at NULL -> hodnota)
CREATE OR REPLACE FUNCTION public.trg_add_xp_assignment_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'submitted'
     AND NEW.submitted_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.submitted_at IS NULL)
     AND NEW.student_id IS NOT NULL THEN
    PERFORM public.add_xp(NEW.student_id, 20);
  END IF;
  RETURN NEW;
END;
$$;

-- 7) Žebříček: bezpečná funkce pro spolužáky stejné třídy
CREATE OR REPLACE FUNCTION public.class_leaderboard(_class_id uuid)
RETURNS TABLE (
  student_id uuid,
  total_xp integer,
  level integer,
  badge_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.user_id AS student_id,
         COALESCE(x.total_xp, 0) AS total_xp,
         COALESCE(x.level, 1) AS level,
         (SELECT count(*) FROM public.student_badges b WHERE b.student_id = cm.user_id) AS badge_count
  FROM public.class_members cm
  LEFT JOIN public.student_xp x ON x.student_id = cm.user_id
  WHERE cm.class_id = _class_id
    AND (
      is_admin()
      OR is_class_teacher(_class_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.class_members me
        WHERE me.class_id = _class_id AND me.user_id = auth.uid()
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.class_leaderboard(uuid) TO authenticated;