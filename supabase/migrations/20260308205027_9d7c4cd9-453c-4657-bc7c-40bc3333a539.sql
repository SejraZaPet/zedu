
-- Create a helper to check if user is admin or teacher
CREATE OR REPLACE FUNCTION public.is_admin_or_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'teacher')
  )
$$;

-- Allow teachers to INSERT subjects
CREATE POLICY "Teacher can insert textbook_subjects" ON public.textbook_subjects
  FOR INSERT WITH CHECK (public.is_admin_or_teacher());

-- Allow teachers to UPDATE subjects
CREATE POLICY "Teacher can update textbook_subjects" ON public.textbook_subjects
  FOR UPDATE USING (public.is_admin_or_teacher());

-- Allow teachers to DELETE subjects
CREATE POLICY "Teacher can delete textbook_subjects" ON public.textbook_subjects
  FOR DELETE USING (public.is_admin_or_teacher());

-- Also allow teachers to read subjects (currently only approved users via can_access_textbooks)
-- This is already covered by existing policy, so no change needed for SELECT.

-- Same for textbook_grades, textbook_topics, textbook_lessons, lessons, lesson_topic_assignments
-- Teachers need write access to these content tables too

CREATE POLICY "Teacher can insert textbook_grades" ON public.textbook_grades
  FOR INSERT WITH CHECK (public.is_admin_or_teacher());
CREATE POLICY "Teacher can update textbook_grades" ON public.textbook_grades
  FOR UPDATE USING (public.is_admin_or_teacher());
CREATE POLICY "Teacher can delete textbook_grades" ON public.textbook_grades
  FOR DELETE USING (public.is_admin_or_teacher());

CREATE POLICY "Teacher can insert textbook_topics" ON public.textbook_topics
  FOR INSERT WITH CHECK (public.is_admin_or_teacher());
CREATE POLICY "Teacher can update textbook_topics" ON public.textbook_topics
  FOR UPDATE USING (public.is_admin_or_teacher());
CREATE POLICY "Teacher can delete textbook_topics" ON public.textbook_topics
  FOR DELETE USING (public.is_admin_or_teacher());

CREATE POLICY "Teacher can insert textbook_lessons" ON public.textbook_lessons
  FOR INSERT WITH CHECK (public.is_admin_or_teacher());
CREATE POLICY "Teacher can update textbook_lessons" ON public.textbook_lessons
  FOR UPDATE USING (public.is_admin_or_teacher());
CREATE POLICY "Teacher can delete textbook_lessons" ON public.textbook_lessons
  FOR DELETE USING (public.is_admin_or_teacher());

CREATE POLICY "Teacher can insert lessons" ON public.lessons
  FOR INSERT WITH CHECK (public.is_admin_or_teacher());
CREATE POLICY "Teacher can update lessons" ON public.lessons
  FOR UPDATE USING (public.is_admin_or_teacher());
CREATE POLICY "Teacher can delete lessons" ON public.lessons
  FOR DELETE USING (public.is_admin_or_teacher());

CREATE POLICY "Teacher can insert lesson_topic_assignments" ON public.lesson_topic_assignments
  FOR INSERT WITH CHECK (public.is_admin_or_teacher());
CREATE POLICY "Teacher can update lesson_topic_assignments" ON public.lesson_topic_assignments
  FOR UPDATE USING (public.is_admin_or_teacher());
CREATE POLICY "Teacher can delete lesson_topic_assignments" ON public.lesson_topic_assignments
  FOR DELETE USING (public.is_admin_or_teacher());

-- Classes: teachers should manage classes too
CREATE POLICY "Teacher can insert classes" ON public.classes
  FOR INSERT WITH CHECK (public.is_admin_or_teacher());
CREATE POLICY "Teacher can update classes" ON public.classes
  FOR UPDATE USING (public.is_admin_or_teacher());
CREATE POLICY "Teacher can delete classes" ON public.classes
  FOR DELETE USING (public.is_admin_or_teacher());
CREATE POLICY "Teacher can read classes" ON public.classes
  FOR SELECT USING (public.is_admin_or_teacher());

CREATE POLICY "Teacher can insert class_members" ON public.class_members
  FOR INSERT WITH CHECK (public.is_admin_or_teacher());
CREATE POLICY "Teacher can read class_members" ON public.class_members
  FOR SELECT USING (public.is_admin_or_teacher());
CREATE POLICY "Teacher can delete class_members" ON public.class_members
  FOR DELETE USING (public.is_admin_or_teacher());
