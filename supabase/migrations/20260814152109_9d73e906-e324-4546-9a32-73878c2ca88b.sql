ALTER TABLE public.textbook_subjects ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_textbook_subjects_created_by ON public.textbook_subjects(created_by);

-- Nová bezpečná pravidla pro zápis
DROP POLICY IF EXISTS "Teacher can insert textbook_subjects" ON public.textbook_subjects;
DROP POLICY IF EXISTS "Teacher can update textbook_subjects" ON public.textbook_subjects;
DROP POLICY IF EXISTS "Teacher can delete textbook_subjects" ON public.textbook_subjects;

CREATE POLICY "Teachers can create subjects"
ON public.textbook_subjects FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_teacher() AND (created_by IS NULL OR created_by = auth.uid()));

CREATE POLICY "Owner or admin can update subjects"
ON public.textbook_subjects FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR (created_by IS NOT NULL AND created_by = auth.uid())
  OR (created_by IS NOT NULL AND public.is_school_admin(auth.uid())
      AND public.get_user_school_id(created_by) IS NOT NULL
      AND public.get_user_school_id(created_by) = public.get_user_school_id(auth.uid()))
)
WITH CHECK (
  public.is_admin()
  OR (created_by IS NOT NULL AND created_by = auth.uid())
  OR (created_by IS NOT NULL AND public.is_school_admin(auth.uid())
      AND public.get_user_school_id(created_by) IS NOT NULL
      AND public.get_user_school_id(created_by) = public.get_user_school_id(auth.uid()))
);

CREATE POLICY "Owner or admin can delete subjects"
ON public.textbook_subjects FOR DELETE TO authenticated
USING (
  public.is_admin()
  OR (created_by IS NOT NULL AND created_by = auth.uid())
  OR (created_by IS NOT NULL AND public.is_school_admin(auth.uid())
      AND public.get_user_school_id(created_by) IS NOT NULL
      AND public.get_user_school_id(created_by) = public.get_user_school_id(auth.uid()))
);