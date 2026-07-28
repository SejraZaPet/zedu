
-- student_books
CREATE TABLE public.student_books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  cover_image_url TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_student_books_student ON public.student_books(student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_books TO authenticated;
GRANT ALL ON public.student_books TO service_role;

ALTER TABLE public.student_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student manages own books"
  ON public.student_books FOR ALL
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Teachers view published books of their students"
  ON public.student_books FOR SELECT
  USING (published = true AND public.is_teacher_of_student(student_id, auth.uid()));

CREATE POLICY "Parents view published books of their child"
  ON public.student_books FOR SELECT
  USING (published = true AND public.is_parent_of_student(student_id, auth.uid()));

CREATE POLICY "Admins view all books"
  ON public.student_books FOR SELECT
  USING (public.is_admin());

CREATE TRIGGER update_student_books_updated_at
  BEFORE UPDATE ON public.student_books
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- student_book_pages
CREATE TABLE public.student_book_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES public.student_books(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  text TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_student_book_pages_book ON public.student_book_pages(book_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_book_pages TO authenticated;
GRANT ALL ON public.student_book_pages TO service_role;

ALTER TABLE public.student_book_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student manages own book pages"
  ON public.student_book_pages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.student_books b WHERE b.id = book_id AND b.student_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.student_books b WHERE b.id = book_id AND b.student_id = auth.uid()));

CREATE POLICY "Teachers view pages of published books of their students"
  ON public.student_book_pages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.student_books b
    WHERE b.id = book_id AND b.published = true
      AND public.is_teacher_of_student(b.student_id, auth.uid())
  ));

CREATE POLICY "Parents view pages of published books of their child"
  ON public.student_book_pages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.student_books b
    WHERE b.id = book_id AND b.published = true
      AND public.is_parent_of_student(b.student_id, auth.uid())
  ));

CREATE POLICY "Admins view all book pages"
  ON public.student_book_pages FOR SELECT
  USING (public.is_admin());

CREATE TRIGGER update_student_book_pages_updated_at
  BEFORE UPDATE ON public.student_book_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create portfolio item on publish
CREATE OR REPLACE FUNCTION public.tg_student_book_portfolio_on_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.published = true AND (OLD.published IS DISTINCT FROM true) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.student_portfolio_items
      WHERE student_id = NEW.student_id
        AND source_type = 'creative_book'
        AND (content_json->>'book_id') = NEW.id::text
    ) THEN
      INSERT INTO public.student_portfolio_items
        (student_id, type, title, description, subject, source_type, content_json)
      VALUES (
        NEW.student_id,
        'project',
        NEW.title,
        NULL,
        NEW.subject,
        'creative_book',
        jsonb_build_object('book_id', NEW.id, 'cover_image_url', NEW.cover_image_url)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_student_book_portfolio_on_publish
  AFTER INSERT OR UPDATE OF published ON public.student_books
  FOR EACH ROW EXECUTE FUNCTION public.tg_student_book_portfolio_on_publish();
