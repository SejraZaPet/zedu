
-- Create security definer function to check enrollment without triggering RLS
CREATE OR REPLACE FUNCTION public.is_enrolled_in_textbook(_textbook_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_textbook_enrollments
    WHERE textbook_id = _textbook_id AND student_id = _student_id
  )
$$;

-- Create security definer function to check textbook ownership
CREATE OR REPLACE FUNCTION public.owns_textbook(_textbook_id uuid, _teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_textbooks
    WHERE id = _textbook_id AND teacher_id = _teacher_id
  )
$$;

-- Fix teacher_textbooks: drop and recreate enrollment policy using security definer
DROP POLICY IF EXISTS "Enrolled students can read textbooks" ON public.teacher_textbooks;
CREATE POLICY "Enrolled students can read textbooks" ON public.teacher_textbooks
  FOR SELECT USING (public.is_enrolled_in_textbook(id, auth.uid()));

-- Fix teacher_textbook_enrollments: drop and recreate teacher read policy
DROP POLICY IF EXISTS "Teachers can read enrollments for own textbooks" ON public.teacher_textbook_enrollments;
CREATE POLICY "Teachers can read enrollments for own textbooks" ON public.teacher_textbook_enrollments
  FOR SELECT USING (public.owns_textbook(textbook_id, auth.uid()));

-- Fix teacher_textbook_lessons policies that reference teacher_textbooks
DROP POLICY IF EXISTS "Enrolled students can read lessons" ON public.teacher_textbook_lessons;
CREATE POLICY "Enrolled students can read lessons" ON public.teacher_textbook_lessons
  FOR SELECT USING (public.is_enrolled_in_textbook(textbook_id, auth.uid()));

DROP POLICY IF EXISTS "Teachers can read own textbook lessons" ON public.teacher_textbook_lessons;
CREATE POLICY "Teachers can read own textbook lessons" ON public.teacher_textbook_lessons
  FOR SELECT USING (public.owns_textbook(textbook_id, auth.uid()));

DROP POLICY IF EXISTS "Teachers can insert own textbook lessons" ON public.teacher_textbook_lessons;
CREATE POLICY "Teachers can insert own textbook lessons" ON public.teacher_textbook_lessons
  FOR INSERT WITH CHECK (public.owns_textbook(textbook_id, auth.uid()));

DROP POLICY IF EXISTS "Teachers can update own textbook lessons" ON public.teacher_textbook_lessons;
CREATE POLICY "Teachers can update own textbook lessons" ON public.teacher_textbook_lessons
  FOR UPDATE USING (public.owns_textbook(textbook_id, auth.uid()));

DROP POLICY IF EXISTS "Teachers can delete own textbook lessons" ON public.teacher_textbook_lessons;
CREATE POLICY "Teachers can delete own textbook lessons" ON public.teacher_textbook_lessons
  FOR DELETE USING (public.owns_textbook(textbook_id, auth.uid()));
