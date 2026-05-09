-- 1) Table
CREATE TABLE IF NOT EXISTS public.teacher_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  filename text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_media_teacher ON public.teacher_media(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_media_tags ON public.teacher_media USING GIN(tags);

ALTER TABLE public.teacher_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_owner_select" ON public.teacher_media
  FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "media_owner_insert" ON public.teacher_media
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "media_owner_update" ON public.teacher_media
  FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "media_owner_delete" ON public.teacher_media
  FOR DELETE USING (auth.uid() = teacher_id);

DROP TRIGGER IF EXISTS trg_teacher_media_updated ON public.teacher_media;
CREATE TRIGGER trg_teacher_media_updated
BEFORE UPDATE ON public.teacher_media
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('teacher-media', 'teacher-media', false)
ON CONFLICT (id) DO NOTHING;

-- 3) Storage policies — scope by first folder segment = auth.uid()
DROP POLICY IF EXISTS "teacher_media_select_own" ON storage.objects;
DROP POLICY IF EXISTS "teacher_media_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "teacher_media_update_own" ON storage.objects;
DROP POLICY IF EXISTS "teacher_media_delete_own" ON storage.objects;

CREATE POLICY "teacher_media_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'teacher-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "teacher_media_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'teacher-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "teacher_media_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'teacher-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "teacher_media_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'teacher-media' AND auth.uid()::text = (storage.foldername(name))[1]);