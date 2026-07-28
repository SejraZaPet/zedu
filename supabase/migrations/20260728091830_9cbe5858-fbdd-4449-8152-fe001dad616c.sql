-- 1) grading_rubrics
CREATE TABLE public.grading_rubrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_grading_rubrics_teacher ON public.grading_rubrics(teacher_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grading_rubrics TO authenticated;
GRANT ALL ON public.grading_rubrics TO service_role;
ALTER TABLE public.grading_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads rubrics" ON public.grading_rubrics FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.is_admin());
CREATE POLICY "Owner inserts rubric" ON public.grading_rubrics FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Owner updates rubric" ON public.grading_rubrics FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "Owner deletes rubric" ON public.grading_rubrics FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

CREATE TRIGGER set_grading_rubrics_updated_at
BEFORE UPDATE ON public.grading_rubrics
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) rubric_criteria
CREATE TABLE public.rubric_criteria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rubric_id UUID NOT NULL REFERENCES public.grading_rubrics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rubric_criteria_rubric ON public.rubric_criteria(rubric_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rubric_criteria TO authenticated;
GRANT ALL ON public.rubric_criteria TO service_role;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rubric owner reads criteria" ON public.rubric_criteria FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.grading_rubrics r
      WHERE r.id = rubric_id AND r.teacher_id = auth.uid()
    )
  );
CREATE POLICY "Rubric owner writes criteria" ON public.rubric_criteria FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.grading_rubrics r WHERE r.id = rubric_id AND r.teacher_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.grading_rubrics r WHERE r.id = rubric_id AND r.teacher_id = auth.uid())
  );

-- 3) rubric_levels
CREATE TABLE public.rubric_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  criterion_id UUID NOT NULL REFERENCES public.rubric_criteria(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  points NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rubric_levels_criterion ON public.rubric_levels(criterion_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rubric_levels TO authenticated;
GRANT ALL ON public.rubric_levels TO service_role;
ALTER TABLE public.rubric_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rubric owner reads levels" ON public.rubric_levels FOR SELECT TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.rubric_criteria c
      JOIN public.grading_rubrics r ON r.id = c.rubric_id
      WHERE c.id = criterion_id AND r.teacher_id = auth.uid()
    )
  );
CREATE POLICY "Rubric owner writes levels" ON public.rubric_levels FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rubric_criteria c
      JOIN public.grading_rubrics r ON r.id = c.rubric_id
      WHERE c.id = criterion_id AND r.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rubric_criteria c
      JOIN public.grading_rubrics r ON r.id = c.rubric_id
      WHERE c.id = criterion_id AND r.teacher_id = auth.uid()
    )
  );

-- 4) rubric_evaluations
CREATE TABLE public.rubric_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_item_id UUID NOT NULL REFERENCES public.student_portfolio_items(id) ON DELETE CASCADE,
  rubric_id UUID NOT NULL REFERENCES public.grading_rubrics(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_points NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rubric_evaluations_item ON public.rubric_evaluations(portfolio_item_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rubric_evaluations TO authenticated;
GRANT ALL ON public.rubric_evaluations TO service_role;
ALTER TABLE public.rubric_evaluations ENABLE ROW LEVEL SECURITY;

-- Read: student, teacher-of-student, parent, admin, author
CREATE POLICY "Read rubric evaluations" ON public.rubric_evaluations FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.student_portfolio_items i
      WHERE i.id = portfolio_item_id
        AND (
          i.student_id = auth.uid()
          OR public.is_teacher_of_student(i.student_id, auth.uid())
          OR public.is_parent_of_student(i.student_id, auth.uid())
        )
    )
  );
-- Insert: teacher of the student
CREATE POLICY "Teacher creates rubric evaluation" ON public.rubric_evaluations FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.student_portfolio_items i
        WHERE i.id = portfolio_item_id
          AND public.is_teacher_of_student(i.student_id, auth.uid())
      )
    )
  );
CREATE POLICY "Author deletes rubric evaluation" ON public.rubric_evaluations FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- 5) rubric_evaluation_scores
CREATE TABLE public.rubric_evaluation_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_id UUID NOT NULL REFERENCES public.rubric_evaluations(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES public.rubric_criteria(id) ON DELETE RESTRICT,
  level_id UUID NOT NULL REFERENCES public.rubric_levels(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, criterion_id)
);
CREATE INDEX idx_rubric_eval_scores_eval ON public.rubric_evaluation_scores(evaluation_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rubric_evaluation_scores TO authenticated;
GRANT ALL ON public.rubric_evaluation_scores TO service_role;
ALTER TABLE public.rubric_evaluation_scores ENABLE ROW LEVEL SECURITY;

-- Read: mirror rubric_evaluations visibility
CREATE POLICY "Read rubric eval scores" ON public.rubric_evaluation_scores FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rubric_evaluations e
      LEFT JOIN public.student_portfolio_items i ON i.id = e.portfolio_item_id
      WHERE e.id = evaluation_id
        AND (
          e.teacher_id = auth.uid()
          OR public.is_admin()
          OR i.student_id = auth.uid()
          OR public.is_teacher_of_student(i.student_id, auth.uid())
          OR public.is_parent_of_student(i.student_id, auth.uid())
        )
    )
  );
CREATE POLICY "Author writes rubric eval scores" ON public.rubric_evaluation_scores FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.rubric_evaluations e WHERE e.id = evaluation_id AND e.teacher_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.rubric_evaluations e WHERE e.id = evaluation_id AND e.teacher_id = auth.uid())
  );