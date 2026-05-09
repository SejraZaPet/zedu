-- lesson_plan_phases: phases for a teacher's lesson plan / scheduled lesson
CREATE TABLE public.lesson_plan_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_plan_id UUID REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL,
  subject TEXT,
  lesson_date DATE,
  start_time TEXT,
  end_time TEXT,
  plan_title TEXT,
  phase_key TEXT NOT NULL,
  title TEXT,
  duration_min INT NOT NULL DEFAULT 0,
  content TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lpp_lesson_plan ON public.lesson_plan_phases(lesson_plan_id);
CREATE INDEX idx_lpp_teacher_lookup ON public.lesson_plan_phases(teacher_id, subject, lesson_date, start_time);

ALTER TABLE public.lesson_plan_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage all lesson_plan_phases"
ON public.lesson_plan_phases FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Teachers can read own lesson_plan_phases"
ON public.lesson_plan_phases FOR SELECT
TO authenticated
USING (
  auth.uid() = teacher_id
  OR EXISTS (
    SELECT 1 FROM public.lesson_plans lp
    WHERE lp.id = lesson_plan_phases.lesson_plan_id
      AND lp.teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers can insert own lesson_plan_phases"
ON public.lesson_plan_phases FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = teacher_id
  AND (
    lesson_plan_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.lesson_plans lp
      WHERE lp.id = lesson_plan_phases.lesson_plan_id
        AND lp.teacher_id = auth.uid()
    )
  )
);

CREATE POLICY "Teachers can update own lesson_plan_phases"
ON public.lesson_plan_phases FOR UPDATE
TO authenticated
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete own lesson_plan_phases"
ON public.lesson_plan_phases FOR DELETE
TO authenticated
USING (auth.uid() = teacher_id);

CREATE TRIGGER trg_lpp_updated_at
BEFORE UPDATE ON public.lesson_plan_phases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();