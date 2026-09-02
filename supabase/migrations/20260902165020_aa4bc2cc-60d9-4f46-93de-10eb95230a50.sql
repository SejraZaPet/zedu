CREATE OR REPLACE FUNCTION public.is_worksheet_in_direct_shared_textbook(_worksheet_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.worksheet_lessons wl
    JOIN public.teacher_textbook_lessons ttl ON ttl.id = wl.lesson_id
    JOIN public.content_shares cs ON cs.textbook_id = ttl.textbook_id
    WHERE wl.worksheet_id = _worksheet_id
      AND cs.shared_with = _user_id
      AND cs.status = 'active'
      AND cs.includes_worksheets
  )
$$;

REVOKE ALL ON FUNCTION public.is_worksheet_in_direct_shared_textbook(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_worksheet_in_direct_shared_textbook(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Shared recipients can read linked worksheets" ON public.worksheets;
CREATE POLICY "Shared recipients can read linked worksheets"
ON public.worksheets
FOR SELECT
TO authenticated
USING (public.is_worksheet_in_direct_shared_textbook(id, auth.uid()));