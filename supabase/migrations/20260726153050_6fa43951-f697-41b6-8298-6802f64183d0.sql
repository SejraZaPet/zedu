
-- 1. Table
CREATE TABLE public.teacher_curriculum_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text NOT NULL,
  content text,
  file_url text,
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, subject)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_curriculum_plans TO authenticated;
GRANT ALL ON public.teacher_curriculum_plans TO service_role;

ALTER TABLE public.teacher_curriculum_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their own curriculum plans"
  ON public.teacher_curriculum_plans FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert their own curriculum plans"
  ON public.teacher_curriculum_plans FOR INSERT
  TO authenticated
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update their own curriculum plans"
  ON public.teacher_curriculum_plans FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete their own curriculum plans"
  ON public.teacher_curriculum_plans FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE TRIGGER update_teacher_curriculum_plans_updated_at
  BEFORE UPDATE ON public.teacher_curriculum_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_teacher_curriculum_plans_teacher ON public.teacher_curriculum_plans(teacher_id);

-- 2. Storage policies for curriculum-plans bucket (bucket itself created via tool)
CREATE POLICY "Teachers read own curriculum files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'curriculum-plans'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Teachers upload own curriculum files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'curriculum-plans'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Teachers update own curriculum files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'curriculum-plans'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Teachers delete own curriculum files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'curriculum-plans'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
