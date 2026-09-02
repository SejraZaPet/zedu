ALTER TABLE public.teacher_textbooks
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_textbooks_deleted_at
  ON public.teacher_textbooks (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Owner-or-admin update (soft delete / restore) and delete (permanent, from trash)
DROP POLICY IF EXISTS "Teachers can update own textbooks" ON public.teacher_textbooks;
CREATE POLICY "Teachers can update own textbooks"
  ON public.teacher_textbooks FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Admin can update all teacher_textbooks" ON public.teacher_textbooks;
CREATE POLICY "Admin can update all teacher_textbooks"
  ON public.teacher_textbooks FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Permanent purge helper (NOT scheduled)
CREATE OR REPLACE FUNCTION public.purge_deleted_textbooks(_older_than_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  WITH del AS (
    DELETE FROM public.teacher_textbooks
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - make_interval(days => _older_than_days)
    RETURNING id
  )
  SELECT count(*) INTO _count FROM del;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_deleted_textbooks(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_deleted_textbooks(integer) TO service_role;