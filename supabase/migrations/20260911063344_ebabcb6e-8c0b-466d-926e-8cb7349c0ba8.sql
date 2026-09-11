DROP POLICY IF EXISTS "Authorized staff can insert class_textbooks" ON public.class_textbooks;

CREATE POLICY "Authorized staff can insert class_textbooks"
ON public.class_textbooks
FOR INSERT
TO authenticated
WITH CHECK (
  added_by = auth.uid()
  AND (
    public.is_class_teacher(class_id, auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.classes c
      WHERE c.id = class_textbooks.class_id
        AND (
          public.is_admin()
          OR public.is_school_admin_of(c.school_id, auth.uid())
        )
        AND (
          (
            class_textbooks.textbook_type = 'global'
            AND EXISTS (
              SELECT 1
              FROM public.textbook_subjects ts
              WHERE ts.id = class_textbooks.textbook_id
                AND COALESCE(ts.active, true)
            )
          )
          OR (
            class_textbooks.textbook_type = 'teacher'
            AND EXISTS (
              SELECT 1
              FROM public.teacher_textbooks tt
              JOIN public.profiles owner_profile ON owner_profile.id = tt.teacher_id
              WHERE tt.id = class_textbooks.textbook_id
                AND tt.deleted_at IS NULL
                AND owner_profile.school_id = c.school_id
            )
          )
        )
    )
  )
);

DROP FUNCTION IF EXISTS public.can_attach_textbook_to_class(uuid, uuid, text, uuid);