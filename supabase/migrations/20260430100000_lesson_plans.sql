-- ─────────────────────────────────────────────
-- 1. lesson_plans
-- ─────────────────────────────────────────────
CREATE TABLE public.lesson_plans (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL DEFAULT 'Nový plán hodin',
  description text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_plans_teacher ON public.lesson_plans(teacher_id, updated_at DESC);

ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own lesson plans" ON public.lesson_plans
  FOR ALL TO authenticated
  USING  (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Admin can manage all lesson plans" ON public.lesson_plans
  FOR ALL TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_lesson_plans_updated_at
  BEFORE UPDATE ON public.lesson_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────
-- 2. lesson_plan_lessons  (M:N plán ↔ lekce)
-- ─────────────────────────────────────────────
CREATE TABLE public.lesson_plan_lessons (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_plan_id uuid        NOT NULL REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  lesson_id      uuid        NOT NULL,
  lesson_type    text        NOT NULL CHECK (lesson_type IN ('global', 'teacher')),
  sort_order     integer     NOT NULL DEFAULT 0,
  added_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_plan_id, lesson_id, lesson_type)
);

CREATE INDEX idx_lesson_plan_lessons_plan ON public.lesson_plan_lessons(lesson_plan_id, sort_order);

ALTER TABLE public.lesson_plan_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own lesson plan lessons" ON public.lesson_plan_lessons
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_plans lp
      WHERE lp.id = lesson_plan_id AND lp.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lesson_plans lp
      WHERE lp.id = lesson_plan_id AND lp.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admin can manage all lesson plan lessons" ON public.lesson_plan_lessons
  FOR ALL TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────────
-- 3. lesson_plan_worksheets  (M:N plán ↔ list)
-- ─────────────────────────────────────────────
CREATE TABLE public.lesson_plan_worksheets (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_plan_id uuid        NOT NULL REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  worksheet_id   uuid        NOT NULL REFERENCES public.worksheets(id) ON DELETE CASCADE,
  sort_order     integer     NOT NULL DEFAULT 0,
  added_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_plan_id, worksheet_id)
);

CREATE INDEX idx_lesson_plan_worksheets_plan ON public.lesson_plan_worksheets(lesson_plan_id, sort_order);

ALTER TABLE public.lesson_plan_worksheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own lesson plan worksheets" ON public.lesson_plan_worksheets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lesson_plans lp
      WHERE lp.id = lesson_plan_id AND lp.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lesson_plans lp
      WHERE lp.id = lesson_plan_id AND lp.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admin can manage all lesson plan worksheets" ON public.lesson_plan_worksheets
  FOR ALL TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());
