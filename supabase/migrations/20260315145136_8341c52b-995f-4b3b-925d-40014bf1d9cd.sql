
-- Export jobs table
CREATE TABLE public.export_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_plan_id uuid REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  format text NOT NULL DEFAULT 'html',
  status text NOT NULL DEFAULT 'queued',
  attempt integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  error_message text,
  output_url text,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone
);

ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage own export_jobs"
  ON public.export_jobs FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Admin can manage export_jobs"
  ON public.export_jobs FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Storage bucket for exports
INSERT INTO storage.buckets (id, name, public) VALUES ('exports', 'exports', true);

-- Storage RLS: teachers can upload/read own exports
CREATE POLICY "Teachers can upload exports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Teachers can read own exports"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can read exports"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'exports');
