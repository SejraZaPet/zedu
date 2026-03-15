
-- Assignments table: teacher creates an assignment from a lesson plan
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  lesson_plan_id uuid REFERENCES public.lesson_plans(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  activity_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  deadline timestamp with time zone,
  max_attempts integer NOT NULL DEFAULT 1,
  randomize_choices boolean NOT NULL DEFAULT false,
  randomize_order boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can insert own assignments" ON public.assignments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can read own assignments" ON public.assignments
  FOR SELECT TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own assignments" ON public.assignments
  FOR UPDATE TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own assignments" ON public.assignments
  FOR DELETE TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Admin can manage assignments" ON public.assignments
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Students can read assigned assignments" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    status = 'published' AND (
      class_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.class_members cm
        WHERE cm.class_id = assignments.class_id AND cm.user_id = auth.uid()
      )
    )
  );

-- Assignment attempts: tracks each student attempt
CREATE TABLE public.assignment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'in_progress',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score integer,
  max_score integer,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  submitted_at timestamp with time zone,
  last_saved_at timestamp with time zone NOT NULL DEFAULT now(),
  progress jsonb NOT NULL DEFAULT '{"currentIndex": 0, "completed": []}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id, attempt_number)
);

ALTER TABLE public.assignment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can insert own attempts" ON public.assignment_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Students can read own attempts" ON public.assignment_attempts
  FOR SELECT TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "Students can update own attempts" ON public.assignment_attempts
  FOR UPDATE TO authenticated USING (auth.uid() = student_id AND status = 'in_progress');
CREATE POLICY "Teachers can read attempts for own assignments" ON public.assignment_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_attempts.assignment_id AND a.teacher_id = auth.uid()
    )
  );
CREATE POLICY "Admin can manage attempts" ON public.assignment_attempts
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Trigger for updated_at on assignments
CREATE TRIGGER set_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
