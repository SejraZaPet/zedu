CREATE TABLE IF NOT EXISTS public.student_course_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  textbook_id UUID NOT NULL,
  textbook_title TEXT NOT NULL DEFAULT '',
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, textbook_id)
);

GRANT SELECT ON public.student_course_badges TO authenticated;
GRANT ALL ON public.student_course_badges TO service_role;

ALTER TABLE public.student_course_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own course badges"
  ON public.student_course_badges FOR SELECT
  USING (auth.uid() = student_id OR public.is_admin_or_teacher());

CREATE OR REPLACE FUNCTION public.check_course_completion(_textbook_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student UUID := auth.uid();
  _subject TEXT;
  _title TEXT;
  _total INT := 0;
  _done INT := 0;
  _inserted BOOLEAN := false;
BEGIN
  IF _student IS NULL OR _textbook_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT subject, title INTO _subject, _title
  FROM public.teacher_textbooks WHERE id = _textbook_id;
  IF _title IS NULL THEN
    RETURN false;
  END IF;

  WITH lesson_ids AS (
    SELECT id FROM public.teacher_textbook_lessons
      WHERE textbook_id = _textbook_id AND status = 'published'
    UNION
    SELECT tl.id FROM public.textbook_lessons tl
      JOIN public.textbook_topics tt ON tt.id = tl.topic_id
      WHERE tl.status = 'published'
        AND _subject IS NOT NULL AND tt.subject = _subject
  )
  SELECT count(*),
         count(*) FILTER (
           WHERE EXISTS (
             SELECT 1 FROM public.student_lesson_completions slc
             WHERE slc.user_id = _student AND slc.lesson_id = lesson_ids.id
           )
         )
  INTO _total, _done
  FROM lesson_ids;

  IF _total = 0 OR _done < _total THEN
    RETURN false;
  END IF;

  INSERT INTO public.student_course_badges (student_id, textbook_id, textbook_title)
  VALUES (_student, _textbook_id, _title)
  ON CONFLICT (student_id, textbook_id) DO NOTHING;

  IF FOUND THEN
    _inserted := true;
  END IF;

  IF _inserted THEN
    PERFORM public.add_xp(_student, 100);
  END IF;

  RETURN _inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_course_completion(UUID) TO authenticated;