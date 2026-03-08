
-- Fix broken enrolled students SELECT policy (had e.textbook_id = e.id instead of teacher_textbooks.id)
DROP POLICY IF EXISTS "Enrolled students can read textbooks" ON public.teacher_textbooks;

CREATE POLICY "Enrolled students can read textbooks" ON public.teacher_textbooks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teacher_textbook_enrollments e
      WHERE e.textbook_id = teacher_textbooks.id AND e.student_id = auth.uid()
    )
  );

-- Teachers can CRUD their own textbooks
CREATE POLICY "Teachers can read own textbooks" ON public.teacher_textbooks
  FOR SELECT USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own textbooks" ON public.teacher_textbooks
  FOR INSERT WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own textbooks" ON public.teacher_textbooks
  FOR UPDATE USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own textbooks" ON public.teacher_textbooks
  FOR DELETE USING (teacher_id = auth.uid());

-- Admin full access
CREATE POLICY "Admin can read all teacher_textbooks" ON public.teacher_textbooks
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admin can update all teacher_textbooks" ON public.teacher_textbooks
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admin can delete all teacher_textbooks" ON public.teacher_textbooks
  FOR DELETE USING (public.is_admin());
