CREATE OR REPLACE FUNCTION public.tg_subjects_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subjects_set_created_by ON public.subjects;
CREATE TRIGGER subjects_set_created_by
BEFORE INSERT ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.tg_subjects_set_created_by();

DROP POLICY IF EXISTS "Teachers can create subjects" ON public.subjects;
CREATE POLICY "Teachers and admins can create subjects"
ON public.subjects
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.is_admin()
    OR public.is_admin_or_teacher()
  )
);