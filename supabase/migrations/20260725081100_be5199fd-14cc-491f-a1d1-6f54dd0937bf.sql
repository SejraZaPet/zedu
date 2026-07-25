
CREATE OR REPLACE FUNCTION public.get_public_textbook_first_lesson(_textbook_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  hero_image_url text,
  blocks jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _first_id uuid;
BEGIN
  IF NOT public.is_public_shared_textbook(_textbook_id) THEN
    RETURN;
  END IF;

  WITH pub_lessons AS (
    SELECT l.id, l.sort_order
    FROM public.teacher_textbook_lessons l
    WHERE l.textbook_id = _textbook_id AND l.status = 'published'
  ),
  lesson_topic AS (
    SELECT DISTINCT ON (pl.id)
      pl.id AS lesson_id,
      pl.sort_order AS lesson_sort,
      COALESCE(t.sort_order, 9999) AS topic_sort
    FROM pub_lessons pl
    LEFT JOIN public.lesson_placements lp ON lp.lesson_id = pl.id
    LEFT JOIN public.textbook_topics t ON t.id = lp.topic_id
    ORDER BY pl.id, t.sort_order NULLS LAST
  )
  SELECT lt.lesson_id INTO _first_id
    FROM lesson_topic lt
   ORDER BY lt.topic_sort, lt.lesson_sort
   LIMIT 1;

  IF _first_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT l.id, l.title, l.hero_image_url, l.blocks
      FROM public.teacher_textbook_lessons l
     WHERE l.id = _first_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_textbook_first_lesson(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_textbook_first_lesson(uuid) TO authenticated;
