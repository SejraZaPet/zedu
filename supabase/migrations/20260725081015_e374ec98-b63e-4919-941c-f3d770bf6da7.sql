
-- Drop vulnerable RLS policy that allowed any authenticated teacher
-- to read the full content of every lesson in a publicly-shared textbook.
DROP POLICY IF EXISTS "Public share preview: read teacher_textbook_lessons"
  ON public.teacher_textbook_lessons;

-- 1) Outline: chapters + lesson counts (metadata only) of a publicly-shared textbook.
CREATE OR REPLACE FUNCTION public.get_public_textbook_outline(_textbook_id uuid)
RETURNS TABLE (
  textbook_id uuid,
  textbook_title text,
  chapter_id text,
  chapter_title text,
  chapter_sort_order int,
  lesson_count int,
  total_lessons int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tb_title text;
  _total int;
BEGIN
  IF NOT public.is_public_shared_textbook(_textbook_id) THEN
    RETURN;
  END IF;

  SELECT title INTO _tb_title FROM public.teacher_textbooks WHERE id = _textbook_id;
  IF _tb_title IS NULL THEN RETURN; END IF;

  WITH pub_lessons AS (
    SELECT l.id, l.sort_order
    FROM public.teacher_textbook_lessons l
    WHERE l.textbook_id = _textbook_id AND l.status = 'published'
  ),
  lesson_topic AS (
    SELECT DISTINCT ON (pl.id)
      pl.id AS lesson_id,
      lp.topic_id
    FROM pub_lessons pl
    LEFT JOIN public.lesson_placements lp ON lp.lesson_id = pl.id
    ORDER BY pl.id, lp.topic_id NULLS LAST
  ),
  grouped AS (
    SELECT
      COALESCE(lt.topic_id::text, '__no_topic__') AS chapter_id,
      COALESCE(t.title, 'Ostatní lekce') AS chapter_title,
      COALESCE(t.sort_order, 9999) AS chapter_sort_order,
      COUNT(*)::int AS lesson_count
    FROM lesson_topic lt
    LEFT JOIN public.textbook_topics t ON t.id = lt.topic_id
    GROUP BY 1, 2, 3
  )
  SELECT _textbook_id, _tb_title, g.chapter_id, g.chapter_title, g.chapter_sort_order,
         g.lesson_count, (SELECT COUNT(*)::int FROM pub_lessons)
    FROM grouped g
   ORDER BY g.chapter_sort_order
  INTO textbook_id, textbook_title, chapter_id, chapter_title, chapter_sort_order,
       lesson_count, total_lessons;

  -- Re-execute as a proper set-returning query
  RETURN QUERY
  WITH pub_lessons AS (
    SELECT l.id, l.sort_order
    FROM public.teacher_textbook_lessons l
    WHERE l.textbook_id = _textbook_id AND l.status = 'published'
  ),
  lesson_topic AS (
    SELECT DISTINCT ON (pl.id)
      pl.id AS lesson_id,
      lp.topic_id
    FROM pub_lessons pl
    LEFT JOIN public.lesson_placements lp ON lp.lesson_id = pl.id
    ORDER BY pl.id, lp.topic_id NULLS LAST
  ),
  grouped AS (
    SELECT
      COALESCE(lt.topic_id::text, '__no_topic__') AS c_id,
      COALESCE(t.title, 'Ostatní lekce') AS c_title,
      COALESCE(t.sort_order, 9999) AS c_sort,
      COUNT(*)::int AS c_count
    FROM lesson_topic lt
    LEFT JOIN public.textbook_topics t ON t.id = lt.topic_id
    GROUP BY 1, 2, 3
  )
  SELECT _textbook_id, _tb_title, g.c_id, g.c_title, g.c_sort, g.c_count,
         (SELECT COUNT(*)::int FROM pub_lessons)
    FROM grouped g
   ORDER BY g.c_sort;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_textbook_outline(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_textbook_outline(uuid) TO authenticated;

-- 2) Single lesson: full content, only if it is the "first" free lesson OR
--    the caller has an active trial for this textbook.
CREATE OR REPLACE FUNCTION public.get_public_textbook_lesson(
  _textbook_id uuid,
  _lesson_id uuid
)
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
  _first_lesson_id uuid;
  _has_trial boolean;
BEGIN
  IF NOT public.is_public_shared_textbook(_textbook_id) THEN
    RETURN;
  END IF;

  -- lesson must belong to this textbook and be published
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_textbook_lessons
     WHERE id = _lesson_id AND textbook_id = _textbook_id AND status = 'published'
  ) THEN
    RETURN;
  END IF;

  _has_trial := public.has_active_textbook_trial(_textbook_id, auth.uid());

  IF NOT _has_trial THEN
    -- compute "first" lesson: min topic sort_order, then min lesson sort_order
    WITH pub_lessons AS (
      SELECT l.id, l.sort_order
      FROM public.teacher_textbook_lessons l
      WHERE l.textbook_id = _textbook_id AND l.status = 'published'
    ),
    lesson_topic AS (
      SELECT DISTINCT ON (pl.id)
        pl.id AS lesson_id,
        pl.sort_order AS lesson_sort,
        lp.topic_id,
        COALESCE(t.sort_order, 9999) AS topic_sort
      FROM pub_lessons pl
      LEFT JOIN public.lesson_placements lp ON lp.lesson_id = pl.id
      LEFT JOIN public.textbook_topics t ON t.id = lp.topic_id
      ORDER BY pl.id, t.sort_order NULLS LAST
    )
    SELECT lt.lesson_id INTO _first_lesson_id
      FROM lesson_topic lt
     ORDER BY lt.topic_sort, lt.lesson_sort
     LIMIT 1;

    IF _first_lesson_id IS DISTINCT FROM _lesson_id THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
    SELECT l.id, l.title, l.hero_image_url, l.blocks
      FROM public.teacher_textbook_lessons l
     WHERE l.id = _lesson_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_textbook_lesson(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_textbook_lesson(uuid, uuid) TO authenticated;

-- 3) All lessons: full content of every published lesson, ONLY with an
--    active trial for the caller.
CREATE OR REPLACE FUNCTION public.get_public_textbook_all_lessons(_textbook_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  hero_image_url text,
  blocks jsonb,
  topic_id uuid,
  topic_title text,
  topic_sort_order int,
  sort_order int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_public_shared_textbook(_textbook_id) THEN
    RETURN;
  END IF;

  IF NOT public.has_active_textbook_trial(_textbook_id, auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH pub_lessons AS (
    SELECT l.id, l.title, l.hero_image_url, l.blocks, l.sort_order
    FROM public.teacher_textbook_lessons l
    WHERE l.textbook_id = _textbook_id AND l.status = 'published'
  ),
  lesson_topic AS (
    SELECT DISTINCT ON (pl.id)
      pl.id AS lesson_id,
      lp.topic_id
    FROM pub_lessons pl
    LEFT JOIN public.lesson_placements lp ON lp.lesson_id = pl.id
    ORDER BY pl.id, lp.topic_id NULLS LAST
  )
  SELECT pl.id, pl.title, pl.hero_image_url, pl.blocks,
         lt.topic_id,
         t.title,
         COALESCE(t.sort_order, 9999)::int,
         COALESCE(pl.sort_order, 0)::int
    FROM pub_lessons pl
    LEFT JOIN lesson_topic lt ON lt.lesson_id = pl.id
    LEFT JOIN public.textbook_topics t ON t.id = lt.topic_id
   ORDER BY COALESCE(t.sort_order, 9999), COALESCE(pl.sort_order, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_textbook_all_lessons(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_textbook_all_lessons(uuid) TO authenticated;
