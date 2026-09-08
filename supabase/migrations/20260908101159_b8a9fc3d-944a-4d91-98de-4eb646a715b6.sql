-- Helper: může daný uživatel zadat úkol do dané třídy/skupiny?
CREATE OR REPLACE FUNCTION public.can_assign_to_target(_class_id uuid, _group_id uuid, _subject_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND public.is_teaching_staff(_user_id)
    AND (
      public.is_admin()
      OR (
        CASE
          WHEN _group_id IS NOT NULL THEN
            public.owns_subject_group(_group_id, _user_id)
            OR public.is_teaching_unit_collaborator(_subject_id, _class_id, _group_id, _user_id)
          WHEN _class_id IS NOT NULL THEN
            public.is_class_teacher(_class_id, _user_id)
            OR public.is_teaching_unit_collaborator(_subject_id, _class_id, _group_id, _user_id)
          ELSE true  -- úkol bez cílové třídy/skupiny smí založit jen pedagog (viz is_teaching_staff)
        END
      )
    )
$$;

REVOKE ALL ON FUNCTION public.can_assign_to_target(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_assign_to_target(uuid, uuid, uuid, uuid) TO authenticated, service_role;

-- INSERT: autor = přihlášený pedagog + cíl patří jemu
DROP POLICY IF EXISTS "Teachers can insert own assignments" ON public.assignments;
CREATE POLICY "Teaching staff can insert own assignments"
ON public.assignments
FOR INSERT
TO authenticated
WITH CHECK (
  teacher_id = auth.uid()
  AND public.can_assign_to_target(class_id, group_id, subject_id, auth.uid())
);

-- UPDATE: vlastník musí být pedagog a nesmí úkol „přepsat“ na cizí třídu ani cizího autora
DROP POLICY IF EXISTS "Teachers can update own assignments" ON public.assignments;
CREATE POLICY "Teaching staff can update own assignments"
ON public.assignments
FOR UPDATE
TO authenticated
USING (teacher_id = auth.uid() AND public.is_teaching_staff(auth.uid()))
WITH CHECK (
  teacher_id = auth.uid()
  AND public.can_assign_to_target(class_id, group_id, subject_id, auth.uid())
);

DROP POLICY IF EXISTS "Collaborators can update teaching unit assignments" ON public.assignments;
CREATE POLICY "Collaborators can update teaching unit assignments"
ON public.assignments
FOR UPDATE
TO authenticated
USING (
  public.is_teaching_staff(auth.uid())
  AND public.is_teaching_unit_collaborator(subject_id, class_id, group_id, auth.uid())
)
WITH CHECK (
  public.is_teaching_staff(auth.uid())
  AND public.is_teaching_unit_collaborator(subject_id, class_id, group_id, auth.uid())
);

-- DELETE: jen pedagog-autor
DROP POLICY IF EXISTS "Teachers can delete own assignments" ON public.assignments;
CREATE POLICY "Teaching staff can delete own assignments"
ON public.assignments
FOR DELETE
TO authenticated
USING (teacher_id = auth.uid() AND public.is_teaching_staff(auth.uid()));
