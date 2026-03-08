
-- Create tables first (no cross-references in policies yet)
CREATE TABLE public.teacher_textbook_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(textbook_id, student_id)
);

-- Now add FK after teacher_textbooks exists (it was created in previous partial migration)
-- Check if teacher_textbooks exists already
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_textbooks' AND table_schema = 'public') THEN
    CREATE TABLE public.teacher_textbooks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      description text NOT NULL DEFAULT '',
      subject text NOT NULL DEFAULT '',
      teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      access_code text UNIQUE NOT NULL,
      visibility text NOT NULL DEFAULT 'private',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- Add FK on enrollments
ALTER TABLE public.teacher_textbook_enrollments
  ADD CONSTRAINT teacher_textbook_enrollments_textbook_id_fkey
  FOREIGN KEY (textbook_id) REFERENCES public.teacher_textbooks(id) ON DELETE CASCADE;

ALTER TABLE public.teacher_textbook_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read own enrollments" ON public.teacher_textbook_enrollments
  FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Students can enroll themselves" ON public.teacher_textbook_enrollments
  FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Teachers can read enrollments for own textbooks" ON public.teacher_textbook_enrollments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.teacher_textbooks t WHERE t.id = textbook_id AND t.teacher_id = auth.uid())
  );
CREATE POLICY "Admin can read all enrollments" ON public.teacher_textbook_enrollments
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin can delete enrollments" ON public.teacher_textbook_enrollments
  FOR DELETE USING (public.is_admin());

-- Now add the missing policies on teacher_textbooks that reference enrollments
CREATE POLICY "Enrolled students can read textbooks" ON public.teacher_textbooks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.teacher_textbook_enrollments e WHERE e.textbook_id = id AND e.student_id = auth.uid())
  );

-- Lessons table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_textbook_lessons' AND table_schema = 'public') THEN
    CREATE TABLE public.teacher_textbook_lessons (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      textbook_id uuid NOT NULL REFERENCES public.teacher_textbooks(id) ON DELETE CASCADE,
      title text NOT NULL,
      blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
      sort_order int NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'draft',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

ALTER TABLE public.teacher_textbook_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can read own textbook lessons" ON public.teacher_textbook_lessons
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.teacher_textbooks t WHERE t.id = textbook_id AND t.teacher_id = auth.uid())
  );
CREATE POLICY "Teachers can insert own textbook lessons" ON public.teacher_textbook_lessons
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.teacher_textbooks t WHERE t.id = textbook_id AND t.teacher_id = auth.uid())
  );
CREATE POLICY "Teachers can update own textbook lessons" ON public.teacher_textbook_lessons
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.teacher_textbooks t WHERE t.id = textbook_id AND t.teacher_id = auth.uid())
  );
CREATE POLICY "Teachers can delete own textbook lessons" ON public.teacher_textbook_lessons
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.teacher_textbooks t WHERE t.id = textbook_id AND t.teacher_id = auth.uid())
  );
CREATE POLICY "Admin can read all teacher_textbook_lessons" ON public.teacher_textbook_lessons
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin can update all teacher_textbook_lessons" ON public.teacher_textbook_lessons
  FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admin can delete all teacher_textbook_lessons" ON public.teacher_textbook_lessons
  FOR DELETE USING (public.is_admin());
CREATE POLICY "Enrolled students can read lessons" ON public.teacher_textbook_lessons
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.teacher_textbook_enrollments e WHERE e.textbook_id = teacher_textbook_lessons.textbook_id AND e.student_id = auth.uid())
  );

-- Enroll by code function
CREATE OR REPLACE FUNCTION public.enroll_by_textbook_code(_code text, _student_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _textbook_id uuid;
BEGIN
  SELECT id INTO _textbook_id FROM public.teacher_textbooks WHERE access_code = _code;
  IF _textbook_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.teacher_textbook_enrollments (textbook_id, student_id)
  VALUES (_textbook_id, _student_id) ON CONFLICT DO NOTHING;
  RETURN _textbook_id;
END;
$$;

-- Updated_at triggers
CREATE TRIGGER update_teacher_textbooks_updated_at
  BEFORE UPDATE ON public.teacher_textbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teacher_textbook_lessons_updated_at
  BEFORE UPDATE ON public.teacher_textbook_lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
