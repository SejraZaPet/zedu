-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-attachments',
  'student-attachments',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = EXCLUDED.public;

-- Table
CREATE TABLE IF NOT EXISTS public.assignment_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_attachments_assignment ON public.assignment_attachments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_attachments_student ON public.assignment_attachments(student_id);

ALTER TABLE public.assignment_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: students manage their own attachments
CREATE POLICY "Students view own attachments"
  ON public.assignment_attachments FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students upload own attachments"
  ON public.assignment_attachments FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students delete own attachments"
  ON public.assignment_attachments FOR DELETE
  USING (auth.uid() = student_id);

-- Teachers see attachments for assignments they own
CREATE POLICY "Teachers view their students attachments"
  ON public.assignment_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_attachments.assignment_id
        AND a.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.class_teachers ct ON ct.class_id = a.class_id
      WHERE a.id = assignment_attachments.assignment_id
        AND ct.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins view all attachments"
  ON public.assignment_attachments FOR SELECT
  USING (public.is_admin());

-- Storage RLS policies for bucket "student-attachments"
-- Path convention: {assignment_id}/{student_id}/{filename}
CREATE POLICY "Students upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'student-attachments'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

CREATE POLICY "Students view own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'student-attachments'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

CREATE POLICY "Students delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'student-attachments'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

CREATE POLICY "Teachers view their students files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'student-attachments'
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id::text = (storage.foldername(name))[1]
        AND (
          a.teacher_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.class_teachers ct
            WHERE ct.class_id = a.class_id AND ct.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Admins access all attachments"
  ON storage.objects FOR ALL
  USING (bucket_id = 'student-attachments' AND public.is_admin())
  WITH CHECK (bucket_id = 'student-attachments' AND public.is_admin());
