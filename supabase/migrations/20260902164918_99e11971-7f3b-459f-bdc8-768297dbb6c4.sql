CREATE OR REPLACE FUNCTION public.is_direct_shared_textbook(_textbook_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.content_shares cs
    WHERE cs.textbook_id = _textbook_id
      AND cs.shared_with = _user_id
      AND cs.status = 'active'
  )
$$;

REVOKE ALL ON FUNCTION public.is_direct_shared_textbook(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_direct_shared_textbook(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_direct_shared_textbook_with_worksheets(_textbook_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.content_shares cs
    WHERE cs.textbook_id = _textbook_id
      AND cs.shared_with = _user_id
      AND cs.status = 'active'
      AND cs.includes_worksheets
  )
$$;

REVOKE ALL ON FUNCTION public.is_direct_shared_textbook_with_worksheets(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_direct_shared_textbook_with_worksheets(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "Shared recipients can view textbook"
ON public.teacher_textbooks
FOR SELECT
TO authenticated
USING (public.is_direct_shared_textbook(id, auth.uid()));

CREATE POLICY "Shared recipients can view textbook lessons"
ON public.teacher_textbook_lessons
FOR SELECT
TO authenticated
USING (public.is_direct_shared_textbook(textbook_id, auth.uid()));

CREATE POLICY "Shared recipients can read linked worksheet_lessons"
ON public.worksheet_lessons
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_textbook_lessons ttl
    WHERE ttl.id = worksheet_lessons.lesson_id
      AND public.is_direct_shared_textbook_with_worksheets(ttl.textbook_id, auth.uid())
  )
);

CREATE POLICY "Shared recipients can read linked worksheets"
ON public.worksheets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.worksheet_lessons wl
    JOIN public.teacher_textbook_lessons ttl ON ttl.id = wl.lesson_id
    WHERE wl.worksheet_id = worksheets.id
      AND public.is_direct_shared_textbook_with_worksheets(ttl.textbook_id, auth.uid())
  )
);