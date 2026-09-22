ALTER TABLE public.lesson_plans
  ADD COLUMN IF NOT EXISTS materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS class_id uuid,
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS visible_to_students boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visible_from timestamptz,
  ADD COLUMN IF NOT EXISTS lesson_ref_id uuid,
  ADD COLUMN IF NOT EXISTS lesson_source text,
  ADD COLUMN IF NOT EXISTS worksheet_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_lesson_plans_student_target
  ON public.lesson_plans (class_id, group_id)
  WHERE visible_to_students;

CREATE OR REPLACE FUNCTION public.can_student_view_lesson_plan(_class_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (_class_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.class_members cm
      WHERE cm.class_id = _class_id AND cm.user_id = auth.uid()
    ))
    OR
    (_group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.subject_group_members sgm
      WHERE sgm.group_id = _group_id AND sgm.student_id = auth.uid()
    ))
$$;

DROP POLICY IF EXISTS "Students can read published lesson_plans for their class or gro" ON public.lesson_plans;
CREATE POLICY "Students can read published lesson_plans for their class or gro"
ON public.lesson_plans
FOR SELECT
TO authenticated
USING (
  visible_to_students
  AND (visible_from IS NULL OR visible_from <= now())
  AND public.can_student_view_lesson_plan(class_id, group_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plans TO authenticated;
GRANT ALL ON public.lesson_plans TO service_role;