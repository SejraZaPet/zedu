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
          ELSE false  -- úkol bez třídy/skupiny (viditelný všem) smí jen systémový admin
        END
      )
    )
$$;
