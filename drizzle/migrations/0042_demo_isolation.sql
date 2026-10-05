CREATE TABLE IF NOT EXISTS public.demo_shared_users (
  user_id uuid PRIMARY KEY,
  kind text NOT NULL DEFAULT 'classmate',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demo_shared_users TO service_role;
ALTER TABLE public.demo_shared_users ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.demo_shared_users IS 'Sdílené demo účty (seed vlastník ukázek, smyšlení spolužáci). Úklid dvojic je nesmí mazat. Jen service role.';

CREATE OR REPLACE FUNCTION public.demo_visible_user_ids(_uid uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT x FROM public.demo_pairs p, LATERAL (VALUES (p.teacher_user_id),(p.student_user_id)) v(x)
   WHERE _uid IN (p.teacher_user_id, p.student_user_id)
  UNION
  SELECT user_id FROM public.demo_shared_users
  UNION
  SELECT _uid
$$;

CREATE OR REPLACE FUNCTION public.demo_can_see_user(_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.is_demo_user(auth.uid())
      OR _target IN (SELECT public.demo_visible_user_ids(auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.demo_can_see_owned(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.is_demo_user(auth.uid())
      OR _owner IN (SELECT public.demo_visible_user_ids(auth.uid()))
      OR NOT public.is_demo_user(_owner)
$$;

CREATE OR REPLACE FUNCTION public.demo_can_see_class(_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.is_demo_user(auth.uid())
      OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = _class_id
                 AND c.created_by IN (SELECT public.demo_visible_user_ids(auth.uid())))
$$;

CREATE OR REPLACE FUNCTION public.demo_can_see_group(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.is_demo_user(auth.uid())
      OR EXISTS (SELECT 1 FROM public.subject_groups g WHERE g.id = _group_id
                 AND g.created_by IN (SELECT public.demo_visible_user_ids(auth.uid())))
$$;

CREATE OR REPLACE FUNCTION public.demo_can_see_assignment(_aid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.is_demo_user(auth.uid())
      OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = _aid
                 AND a.teacher_id IN (SELECT public.demo_visible_user_ids(auth.uid())))
$$;

CREATE OR REPLACE FUNCTION public.demo_can_see_session(_sid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.is_demo_user(auth.uid())
      OR EXISTS (SELECT 1 FROM public.game_sessions s WHERE s.id = _sid
                 AND s.teacher_id IN (SELECT public.demo_visible_user_ids(auth.uid())))
$$;

CREATE OR REPLACE FUNCTION public.demo_can_see_portfolio_item(_iid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.is_demo_user(auth.uid())
      OR EXISTS (SELECT 1 FROM public.student_portfolio_items i WHERE i.id = _iid
                 AND i.student_id IN (SELECT public.demo_visible_user_ids(auth.uid())))
$$;

REVOKE ALL ON FUNCTION public.demo_visible_user_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demo_visible_user_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.demo_can_see_user(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.demo_can_see_owned(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.demo_can_see_class(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.demo_can_see_group(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.demo_can_see_assignment(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.demo_can_see_session(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.demo_can_see_portfolio_item(uuid) TO authenticated, anon, service_role;

CREATE POLICY demo_iso ON public.classes AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_user(created_by)) WITH CHECK (public.demo_can_see_user(created_by));
CREATE POLICY demo_iso ON public.class_members AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_class(class_id) AND public.demo_can_see_user(user_id))
  WITH CHECK (public.demo_can_see_class(class_id) AND public.demo_can_see_user(user_id));
CREATE POLICY demo_iso ON public.class_teachers AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_class(class_id)) WITH CHECK (public.demo_can_see_class(class_id));
CREATE POLICY demo_iso ON public.subject_groups AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_user(created_by)) WITH CHECK (public.demo_can_see_user(created_by));
CREATE POLICY demo_iso ON public.subject_group_members AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_group(group_id)) WITH CHECK (public.demo_can_see_group(group_id) AND public.demo_can_see_user(student_id));
CREATE POLICY demo_iso ON public.assignments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_user(teacher_id))
  WITH CHECK (public.demo_can_see_user(teacher_id)
    AND (class_id IS NULL OR public.demo_can_see_class(class_id))
    AND (group_id IS NULL OR public.demo_can_see_group(group_id)));
CREATE POLICY demo_iso ON public.assignment_attempts AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_assignment(assignment_id) AND public.demo_can_see_user(student_id))
  WITH CHECK (public.demo_can_see_assignment(assignment_id) AND public.demo_can_see_user(student_id));
CREATE POLICY demo_iso ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_user(id)) WITH CHECK (public.demo_can_see_user(id));
CREATE POLICY demo_iso ON public.notifications AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_user(recipient_id) AND (sender_id IS NULL OR public.demo_can_see_user(sender_id)))
  WITH CHECK (public.demo_can_see_user(recipient_id) AND (sender_id IS NULL OR public.demo_can_see_user(sender_id)));
CREATE POLICY demo_iso ON public.game_sessions AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_user(teacher_id)) WITH CHECK (public.demo_can_see_user(teacher_id));
CREATE POLICY demo_iso ON public.game_players AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_session(session_id)) WITH CHECK (public.demo_can_see_session(session_id));
CREATE POLICY demo_iso ON public.notebooks AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_user(owner_id)) WITH CHECK (public.demo_can_see_user(owner_id));
CREATE POLICY demo_iso ON public.student_portfolio_items AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_user(student_id)) WITH CHECK (public.demo_can_see_user(student_id));
CREATE POLICY demo_iso ON public.student_portfolio_files AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_portfolio_item(portfolio_item_id)) WITH CHECK (public.demo_can_see_portfolio_item(portfolio_item_id));
CREATE POLICY demo_iso ON public.student_portfolio_comments AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_portfolio_item(item_id) AND public.demo_can_see_user(author_id))
  WITH CHECK (public.demo_can_see_portfolio_item(item_id) AND public.demo_can_see_user(author_id));
CREATE POLICY demo_iso ON public.conversation_participants AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_user(user_id)) WITH CHECK (public.demo_can_see_user(user_id));
CREATE POLICY demo_iso ON public.messages AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_user(sender_id)) WITH CHECK (public.demo_can_see_user(sender_id));
CREATE POLICY demo_iso ON public.feedback_reports AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_user(user_id)) WITH CHECK (public.demo_can_see_user(user_id));
CREATE POLICY demo_iso ON public.worksheets AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_owned(teacher_id)) WITH CHECK (public.demo_can_see_owned(teacher_id));
CREATE POLICY demo_iso ON public.teacher_presentations AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_owned(teacher_id)) WITH CHECK (public.demo_can_see_owned(teacher_id));
CREATE POLICY demo_iso ON public.teacher_textbooks AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_owned(teacher_id)) WITH CHECK (public.demo_can_see_owned(teacher_id));
CREATE POLICY demo_iso ON public.question_bank_items AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.demo_can_see_owned(teacher_id)) WITH CHECK (public.demo_can_see_owned(teacher_id));

NOTIFY pgrst, 'reload schema';