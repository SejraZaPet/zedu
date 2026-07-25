
-- COURSES
CREATE TABLE public.academy_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  is_accredited BOOLEAN NOT NULL DEFAULT false,
  accreditation_number TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_courses TO authenticated;
GRANT ALL ON public.academy_courses TO service_role;
ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone auth can view published courses"
  ON public.academy_courses FOR SELECT TO authenticated
  USING (is_published = true OR public.is_admin());
CREATE POLICY "Admins manage courses"
  ON public.academy_courses FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_academy_courses_updated
  BEFORE UPDATE ON public.academy_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MODULES
CREATE TABLE public.academy_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_academy_modules_course ON public.academy_modules(course_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_modules TO authenticated;
GRANT ALL ON public.academy_modules TO service_role;
ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View modules of published courses"
  ON public.academy_modules FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.academy_courses c
      WHERE c.id = course_id AND c.is_published = true
    )
  );
CREATE POLICY "Admins manage modules"
  ON public.academy_modules FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_academy_modules_updated
  BEFORE UPDATE ON public.academy_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ENROLLMENTS
CREATE TABLE public.academy_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(course_id, teacher_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_enrollments TO authenticated;
GRANT ALL ON public.academy_enrollments TO service_role;
ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own enrollments"
  ON public.academy_enrollments FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users create own enrollments"
  ON public.academy_enrollments FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Users update own enrollments"
  ON public.academy_enrollments FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid() OR public.is_admin())
  WITH CHECK (teacher_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users delete own enrollments"
  ON public.academy_enrollments FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() OR public.is_admin());

-- MODULE COMPLETIONS
CREATE TABLE public.academy_module_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.academy_enrollments(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.academy_modules(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, module_id)
);
CREATE INDEX idx_academy_completions_enrollment ON public.academy_module_completions(enrollment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_module_completions TO authenticated;
GRANT ALL ON public.academy_module_completions TO service_role;
ALTER TABLE public.academy_module_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own completions"
  ON public.academy_module_completions FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.academy_enrollments e
      WHERE e.id = enrollment_id AND e.teacher_id = auth.uid()
    )
  );
CREATE POLICY "Users create own completions"
  ON public.academy_module_completions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.academy_enrollments e
      WHERE e.id = enrollment_id AND e.teacher_id = auth.uid()
    )
  );
CREATE POLICY "Users delete own completions"
  ON public.academy_module_completions FOR DELETE TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.academy_enrollments e
      WHERE e.id = enrollment_id AND e.teacher_id = auth.uid()
    )
  );

-- SEED: first course + one module per learning method
DO $$
DECLARE
  _course_id UUID;
  _m RECORD;
  _idx INT := 0;
BEGIN
  INSERT INTO public.academy_courses (title, description, is_published, is_accredited, sort_order)
  VALUES (
    '25 výukových metod ve výuce',
    'Praktický průvodce moderními výukovými metodami a technikami – ke každé metodě najdete stručný popis a konkrétní příklad z hodiny.',
    true, false, 0
  )
  RETURNING id INTO _course_id;

  FOR _m IN
    SELECT name, description, example FROM public.learning_methods ORDER BY name ASC
  LOOP
    INSERT INTO public.academy_modules (course_id, title, content, sort_order)
    VALUES (
      _course_id,
      _m.name,
      '## Co to je' || E'\n' || COALESCE(_m.description, '') || E'\n\n## Příklad z hodiny' || E'\n' || COALESCE(_m.example, ''),
      _idx
    );
    _idx := _idx + 1;
  END LOOP;
END $$;
