ALTER TABLE public.lesson_plans
  ADD COLUMN shared_visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (shared_visibility IN ('private', 'public', 'school', 'link')),
  ADD COLUMN anonymous BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_lesson_plans_visibility ON public.lesson_plans(shared_visibility);

DROP POLICY IF EXISTS "Teachers can read own lesson_plans" ON public.lesson_plans;

CREATE POLICY "Teachers can read accessible lesson_plans"
ON public.lesson_plans FOR SELECT
TO authenticated
USING (
  auth.uid() = teacher_id
  OR shared_visibility = 'public'
  OR (
    shared_visibility = 'school'
    AND public.get_user_school_id(auth.uid()) IS NOT NULL
    AND public.get_user_school_id(teacher_id) = public.get_user_school_id(auth.uid())
  )
);