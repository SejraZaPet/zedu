
-- Helper: is a textbook publicly listed in BezliMarket?
CREATE OR REPLACE FUNCTION public.is_public_shared_textbook(_textbook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.content_shares
    WHERE textbook_id = _textbook_id
      AND shared_with IS NULL
      AND status = 'active'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_public_shared_textbook(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_shared_textbook(uuid) TO authenticated;

-- Allow authenticated teachers/lektors/admins to read publicly shared teacher textbooks (metadata) for marketplace preview.
DROP POLICY IF EXISTS "Public share preview: read teacher_textbooks" ON public.teacher_textbooks;
CREATE POLICY "Public share preview: read teacher_textbooks"
ON public.teacher_textbooks
FOR SELECT
TO authenticated
USING (
  public.is_public_shared_textbook(id)
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('teacher','lektor','admin')
  )
);

-- Allow authenticated teachers/lektors/admins to read lessons of publicly shared teacher textbooks (for outline + first-lesson preview).
DROP POLICY IF EXISTS "Public share preview: read teacher_textbook_lessons" ON public.teacher_textbook_lessons;
CREATE POLICY "Public share preview: read teacher_textbook_lessons"
ON public.teacher_textbook_lessons
FOR SELECT
TO authenticated
USING (
  public.is_public_shared_textbook(textbook_id)
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('teacher','lektor','admin')
  )
);
