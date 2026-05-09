-- Helper: is _user_id a teacher in any class where _student_id is a member?
CREATE OR REPLACE FUNCTION public.is_teacher_of_student(_student_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_members cm
    JOIN public.class_teachers ct ON ct.class_id = cm.class_id
    WHERE cm.user_id = _student_id AND ct.user_id = _user_id
  )
$$;

-- Helper: is _user_id linked as parent to _student_id?
CREATE OR REPLACE FUNCTION public.is_parent_of_student(_student_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_student_links
    WHERE parent_id = _user_id AND student_id = _student_id
  )
$$;

-- Portfolio items
CREATE TABLE public.student_portfolio_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'project',
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  attachment_url TEXT,
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portfolio_items_student ON public.student_portfolio_items(student_id, created_at DESC);

ALTER TABLE public.student_portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student manages own portfolio items"
ON public.student_portfolio_items
FOR ALL
TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Teachers can view portfolios of their students"
ON public.student_portfolio_items
FOR SELECT
TO authenticated
USING (public.is_teacher_of_student(student_id, auth.uid()));

CREATE POLICY "Parents can view their child portfolio"
ON public.student_portfolio_items
FOR SELECT
TO authenticated
USING (public.is_parent_of_student(student_id, auth.uid()));

CREATE POLICY "Admins can view all portfolios"
ON public.student_portfolio_items
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE TRIGGER set_portfolio_items_updated_at
BEFORE UPDATE ON public.student_portfolio_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Teacher comments on portfolio items
CREATE TABLE public.student_portfolio_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.student_portfolio_items(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portfolio_comments_item ON public.student_portfolio_comments(item_id, created_at);

ALTER TABLE public.student_portfolio_comments ENABLE ROW LEVEL SECURITY;

-- Read: student who owns the item, the comment author, teacher of student, parent of student, admin
CREATE POLICY "Read portfolio comments"
ON public.student_portfolio_comments
FOR SELECT
TO authenticated
USING (
  author_id = auth.uid()
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.student_portfolio_items i
    WHERE i.id = item_id
      AND (
        i.student_id = auth.uid()
        OR public.is_teacher_of_student(i.student_id, auth.uid())
        OR public.is_parent_of_student(i.student_id, auth.uid())
      )
  )
);

-- Insert: only teachers (or admin) of the student
CREATE POLICY "Teacher inserts portfolio comment"
ON public.student_portfolio_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.student_portfolio_items i
      WHERE i.id = item_id
        AND public.is_teacher_of_student(i.student_id, auth.uid())
    )
  )
);

-- Update / delete: only the author
CREATE POLICY "Author edits own portfolio comment"
ON public.student_portfolio_comments
FOR UPDATE
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Author deletes own portfolio comment"
ON public.student_portfolio_comments
FOR DELETE
TO authenticated
USING (author_id = auth.uid());

CREATE TRIGGER set_portfolio_comments_updated_at
BEFORE UPDATE ON public.student_portfolio_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for portfolio attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-portfolio', 'student-portfolio', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (folder structure: {student_id}/{filename})
CREATE POLICY "Student uploads to own portfolio folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'student-portfolio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Student manages own portfolio files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'student-portfolio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Student deletes own portfolio files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'student-portfolio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Read portfolio files (owner, teacher, parent, admin)"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'student-portfolio'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_admin()
    OR public.is_teacher_of_student(((storage.foldername(name))[1])::uuid, auth.uid())
    OR public.is_parent_of_student(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);