
-- 1. copied_from columns
ALTER TABLE public.teacher_textbooks
  ADD COLUMN IF NOT EXISTS copied_from_textbook_id uuid NULL
    REFERENCES public.teacher_textbooks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_teacher_textbooks_copied_from
  ON public.teacher_textbooks(copied_from_textbook_id);

ALTER TABLE public.worksheets
  ADD COLUMN IF NOT EXISTS copied_from_worksheet_id uuid NULL
    REFERENCES public.worksheets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_worksheets_copied_from
  ON public.worksheets(copied_from_worksheet_id);

ALTER TABLE public.lesson_plans
  ADD COLUMN IF NOT EXISTS copied_from_lesson_plan_id uuid NULL
    REFERENCES public.lesson_plans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_lesson_plans_copied_from
  ON public.lesson_plans(copied_from_lesson_plan_id);

-- 2. content_reviews table
CREATE TABLE IF NOT EXISTS public.content_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id uuid NULL REFERENCES public.teacher_textbooks(id) ON DELETE CASCADE,
  worksheet_id uuid NULL REFERENCES public.worksheets(id) ON DELETE CASCADE,
  lesson_plan_id uuid NULL REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_reviews_exactly_one_target CHECK (
    (CASE WHEN textbook_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN worksheet_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN lesson_plan_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_content_reviews_reviewer_textbook
  ON public.content_reviews(reviewer_id, textbook_id) WHERE textbook_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_content_reviews_reviewer_worksheet
  ON public.content_reviews(reviewer_id, worksheet_id) WHERE worksheet_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_content_reviews_reviewer_lesson_plan
  ON public.content_reviews(reviewer_id, lesson_plan_id) WHERE lesson_plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_reviews_textbook ON public.content_reviews(textbook_id);
CREATE INDEX IF NOT EXISTS idx_content_reviews_worksheet ON public.content_reviews(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_content_reviews_lesson_plan ON public.content_reviews(lesson_plan_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_reviews TO authenticated;
GRANT ALL ON public.content_reviews TO service_role;

ALTER TABLE public.content_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone signed-in can read reviews (public trust signal in BezliMarket)
CREATE POLICY "Authenticated can read reviews"
  ON public.content_reviews FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: reviewer must own a copy pointing at the reviewed content
CREATE POLICY "Reviewer can insert if owns copy"
  ON public.content_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND (
      (textbook_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.teacher_textbooks tb
        WHERE tb.teacher_id = auth.uid()
          AND tb.copied_from_textbook_id = content_reviews.textbook_id
      ))
      OR
      (worksheet_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.worksheets w
        WHERE w.teacher_id = auth.uid()
          AND w.copied_from_worksheet_id = content_reviews.worksheet_id
      ))
      OR
      (lesson_plan_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.lesson_plans lp
        WHERE lp.teacher_id = auth.uid()
          AND lp.copied_from_lesson_plan_id = content_reviews.lesson_plan_id
      ))
    )
  );

CREATE POLICY "Reviewer can update own review"
  ON public.content_reviews FOR UPDATE
  TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "Reviewer can delete own review"
  ON public.content_reviews FOR DELETE
  TO authenticated
  USING (reviewer_id = auth.uid());

CREATE TRIGGER update_content_reviews_updated_at
  BEFORE UPDATE ON public.content_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
