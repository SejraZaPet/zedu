CREATE TABLE IF NOT EXISTS public.teacher_schedules (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_schedules TO authenticated;
GRANT ALL ON public.teacher_schedules TO service_role;

ALTER TABLE public.teacher_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own schedule"
  ON public.teacher_schedules FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_teacher_schedules_updated_at
  BEFORE UPDATE ON public.teacher_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();