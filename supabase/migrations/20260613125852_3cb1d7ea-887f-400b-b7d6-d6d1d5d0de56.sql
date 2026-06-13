
-- profiles: row-scoped policies
DROP POLICY IF EXISTS "pr_select" ON public.profiles;
DROP POLICY IF EXISTS "pr_update" ON public.profiles;
DROP POLICY IF EXISTS "pr_delete" ON public.profiles;

CREATE POLICY "profiles_select_scoped"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR public.is_admin()
  OR (school_id IS NOT NULL AND public.is_school_admin_of(school_id, auth.uid()))
  OR public.is_teacher_of_student(id, auth.uid())
  OR public.is_parent_of_student(id, auth.uid())
);

CREATE POLICY "profiles_update_self_or_admin"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_delete_admin"
ON public.profiles FOR DELETE TO authenticated
USING (public.is_admin());

-- user_roles: only admin can write
DROP POLICY IF EXISTS "ur_insert" ON public.user_roles;
DROP POLICY IF EXISTS "ur_update" ON public.user_roles;
DROP POLICY IF EXISTS "ur_delete" ON public.user_roles;

CREATE POLICY "user_roles_insert_admin"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "user_roles_update_admin"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "user_roles_delete_admin"
ON public.user_roles FOR DELETE TO authenticated
USING (public.is_admin());

-- game_players: remove client-side score update; only server (SECURITY DEFINER RPC) updates
DROP POLICY IF EXISTS "Players can update own score" ON public.game_players;

-- game_responses: restrict SELECT to the session's teacher
DROP POLICY IF EXISTS "Anyone can read responses" ON public.game_responses;
CREATE POLICY "Teacher reads session responses"
ON public.game_responses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.game_sessions s
    WHERE s.id = session_id AND s.teacher_id = auth.uid()
  )
);
