CREATE OR REPLACE FUNCTION public.can_see_avatar(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.demo_can_see_user(_owner)
    AND (
      _owner = auth.uid()
      OR public.is_admin()
      OR (
        public.get_user_school_id(auth.uid()) IS NOT NULL
        AND public.get_user_school_id(_owner) IS NOT NULL
        AND public.get_user_school_id(_owner) = public.get_user_school_id(auth.uid())
      )
      OR public.is_teacher_of_student(_owner, auth.uid())
      OR public.is_teacher_of_student(auth.uid(), _owner)
      OR public.is_parent_of_student(_owner, auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.class_members mine
        JOIN public.class_members theirs ON theirs.class_id = mine.class_id
        WHERE mine.user_id = auth.uid() AND theirs.user_id = _owner
      )
      OR EXISTS (
        SELECT 1
        FROM public.classes c
        JOIN public.class_members m ON m.class_id = c.id
        WHERE (c.created_by = auth.uid() AND m.user_id = _owner)
           OR (c.created_by = _owner AND m.user_id = auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM public.class_teachers mine
        JOIN public.class_teachers theirs ON theirs.class_id = mine.class_id
        WHERE mine.user_id = auth.uid() AND theirs.user_id = _owner
      )
      OR EXISTS (
        SELECT 1
        FROM public.classes c
        JOIN public.class_teachers ct ON ct.class_id = c.id
        WHERE (c.created_by = auth.uid() AND ct.user_id = _owner)
           OR (c.created_by = _owner AND ct.user_id = auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM public.subject_group_members mine
        JOIN public.subject_group_members theirs ON theirs.group_id = mine.group_id
        WHERE mine.student_id = auth.uid() AND theirs.student_id = _owner
      )
      OR EXISTS (
        SELECT 1
        FROM public.game_players mine
        JOIN public.game_players theirs ON theirs.session_id = mine.session_id
        WHERE mine.user_id = auth.uid() AND theirs.user_id = _owner
      )
      OR EXISTS (
        SELECT 1
        FROM public.game_players theirs
        JOIN public.game_sessions s ON s.id = theirs.session_id
        WHERE theirs.user_id = _owner AND s.teacher_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.conversation_participants mine
        JOIN public.conversation_participants theirs ON theirs.conversation_id = mine.conversation_id
        WHERE mine.user_id = auth.uid() AND theirs.user_id = _owner
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_see_avatar(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_see_avatar(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_see_avatar(uuid) TO authenticated;

DROP POLICY IF EXISTS "avatar_profiles_select_signed_in" ON public.avatar_profiles;
CREATE POLICY "avatar_profiles_select_related"
  ON public.avatar_profiles
  FOR SELECT
  TO authenticated
  USING (public.can_see_avatar(user_id));

DROP POLICY IF EXISTS "Signed in can read subjects" ON public.subjects;
CREATE POLICY "Read global own school or own subjects"
  ON public.subjects
  FOR SELECT
  TO authenticated
  USING (
    school_id IS NULL
    OR school_id = public.get_user_school_id(auth.uid())
    OR created_by = auth.uid()
    OR public.is_admin()
  );