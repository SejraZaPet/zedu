CREATE OR REPLACE FUNCTION public.can_attach_textbook_to_class(
  _class_id uuid,
  _textbook_id uuid,
  _textbook_type text,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    public.is_class_teacher(_class_id, _user_id)
    OR EXISTS (
      SELECT 1
      FROM public.classes c
      WHERE c.id = _class_id
        AND (
          public.is_admin()
          OR public.is_school_admin_of(c.school_id, _user_id)
        )
        AND (
          (
            _textbook_type = 'global'
            AND EXISTS (
              SELECT 1
              FROM public.textbook_subjects ts
              WHERE ts.id = _textbook_id
                AND COALESCE(ts.active, true)
            )
          )
          OR (
            _textbook_type = 'teacher'
            AND EXISTS (
              SELECT 1
              FROM public.teacher_textbooks tt
              JOIN public.profiles owner_profile ON owner_profile.id = tt.teacher_id
              WHERE tt.id = _textbook_id
                AND tt.deleted_at IS NULL
                AND owner_profile.school_id = c.school_id
            )
          )
        )
    )
$$;

REVOKE ALL ON FUNCTION public.can_attach_textbook_to_class(uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_attach_textbook_to_class(uuid, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_attach_textbook_to_class(uuid, uuid, text, uuid) TO service_role;

DROP POLICY IF EXISTS "Class teachers can insert class_textbooks" ON public.class_textbooks;
CREATE POLICY "Authorized staff can insert class_textbooks"
ON public.class_textbooks
FOR INSERT
TO authenticated
WITH CHECK (
  added_by = auth.uid()
  AND public.can_attach_textbook_to_class(class_id, textbook_id, textbook_type, auth.uid())
);

DROP POLICY IF EXISTS "Class members can read class_textbooks" ON public.class_textbooks;
CREATE POLICY "Authorized users can read class_textbooks"
ON public.class_textbooks
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.is_class_teacher(class_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = class_textbooks.class_id
      AND public.is_school_admin_of(c.school_id, auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.class_members cm
    WHERE cm.class_id = class_textbooks.class_id
      AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Class teachers can delete class_textbooks" ON public.class_textbooks;
CREATE POLICY "Authorized staff can delete class_textbooks"
ON public.class_textbooks
FOR DELETE
TO authenticated
USING (
  public.is_admin()
  OR public.is_class_teacher(class_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = class_textbooks.class_id
      AND public.is_school_admin_of(c.school_id, auth.uid())
  )
);