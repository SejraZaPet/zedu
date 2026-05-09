-- Lockdown mode flag on assignments
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS lockdown_mode boolean NOT NULL DEFAULT false;

-- Test sessions tracking violations during locked-down attempts
CREATE TABLE IF NOT EXISTS public.test_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  student_id uuid NOT NULL,
  attempt_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  violations_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  violation_count integer NOT NULL DEFAULT 0,
  left_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_sessions_assignment ON public.test_sessions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_student ON public.test_sessions(student_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_test_sessions_attempt
  ON public.test_sessions(attempt_id) WHERE attempt_id IS NOT NULL;

ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;

-- Students manage their own session
CREATE POLICY "Students insert own test_sessions"
  ON public.test_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students read own test_sessions"
  ON public.test_sessions FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Students update own test_sessions"
  ON public.test_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Teachers see test_sessions for their assignments
CREATE POLICY "Teachers read test_sessions for own assignments"
  ON public.test_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = test_sessions.assignment_id AND a.teacher_id = auth.uid()
    )
  );

-- Admin full access
CREATE POLICY "Admin manage test_sessions"
  ON public.test_sessions FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Auto-update updated_at
CREATE TRIGGER trg_test_sessions_updated_at
BEFORE UPDATE ON public.test_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();