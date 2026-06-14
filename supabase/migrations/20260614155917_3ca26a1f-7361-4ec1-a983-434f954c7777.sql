
-- 1) Tighten user_roles SELECT policy: no more wide-open read.
DROP POLICY IF EXISTS "ur_select" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can read user_roles" ON public.user_roles;

CREATE POLICY "user_roles_select_scoped"
ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin()
  OR (
    public.is_school_admin(auth.uid())
    AND public.get_user_school_id(user_id) IS NOT NULL
    AND public.get_user_school_id(user_id) = public.get_user_school_id(auth.uid())
  )
  OR public.is_teacher_of_student(user_id, auth.uid())
  OR public.is_parent_of_student(user_id, auth.uid())
);

-- 2) Realtime: explicit DENY for anonymous role on realtime.messages
DROP POLICY IF EXISTS "Deny anon realtime read" ON realtime.messages;
DROP POLICY IF EXISTS "Deny anon realtime publish" ON realtime.messages;

CREATE POLICY "Deny anon realtime read"
ON realtime.messages
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

CREATE POLICY "Deny anon realtime publish"
ON realtime.messages
AS RESTRICTIVE
FOR INSERT
TO anon
WITH CHECK (false);

-- 3) Revoke EXECUTE on SECURITY DEFINER helpers from anon (and public default).
--    These are internal helpers / trigger functions / admin-only RPCs that
--    should never be invoked by unauthenticated clients via PostgREST.
DO $$
DECLARE
  _fn text;
  _fns text[] := ARRAY[
    -- internal helpers (still callable by authenticated where needed)
    'is_admin()',
    'is_admin_or_teacher()',
    'is_class_owner(uuid, uuid)',
    'is_class_teacher(uuid, uuid)',
    'is_parent_of_student(uuid, uuid)',
    'is_teacher_of_student(uuid, uuid)',
    'is_school_admin(uuid)',
    'is_school_admin_of(uuid, uuid)',
    'is_enrolled_in_textbook(uuid, uuid)',
    'owns_textbook(uuid, uuid)',
    'can_access_textbooks(uuid)',
    'can_access_realtime_topic(text, uuid)',
    'get_user_school_id(uuid)',
    'has_login_credential(uuid)',
    'get_login_password(uuid)',
    'add_xp(uuid, integer)',
    'increment_player_score(uuid, integer)',
    'claim_export_job(text)',
    'strip_correct_flags(jsonb)',
    'set_user_pin(text)',
    'reset_class_leaderboard(uuid)',
    'cancel_notification(uuid)',
    'send_notification(text, text, text, uuid[], text, timestamptz, text)',
    'send_admin_notification(uuid[], text, text, text)',
    'regenerate_school_registration_code(uuid)',
    'generate_school_registration_code()',
    'generate_teacher_join_code()',
    'generate_game_code()',
    -- trigger functions (never need EXECUTE from clients)
    'handle_new_user()',
    'handle_new_class_owner()',
    'sync_login_password_credential()',
    'auto_approve_on_email_confirm()',
    'update_updated_at_column()',
    'recompute_listing_rating()',
    'bump_listing_downloads()',
    'notify_on_assignment_published()',
    'notify_on_attempt_submitted()',
    'notify_on_class_teacher_added()',
    'notify_on_class_textbook_added()',
    'notify_deadline_soon()',
    'trg_notify_parents_on_grade()',
    'trg_notify_parent_assignment_published()',
    'trg_notify_parent_attempt_graded()',
    'trg_send_push_on_notification()',
    'trg_add_xp_practice_session()',
    'trg_add_xp_assignment_submission()',
    '_fanout_broadcast(uuid)',
    '_resolve_broadcast_recipients(notification_broadcasts)',
    'dispatch_scheduled_notifications()',
    'publish_due_lessons()',
    'publish_due_worksheets()',
    'reap_stale_export_jobs()'
  ];
BEGIN
  FOREACH _fn IN ARRAY _fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', _fn);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip revoke on %: %', _fn, SQLERRM;
    END;
  END LOOP;
END $$;

-- Also revoke from authenticated on functions that should run only from
-- triggers, edge functions, or admin context.
DO $$
DECLARE
  _fn text;
  _fns text[] := ARRAY[
    'handle_new_user()',
    'handle_new_class_owner()',
    'sync_login_password_credential()',
    'auto_approve_on_email_confirm()',
    'update_updated_at_column()',
    'recompute_listing_rating()',
    'bump_listing_downloads()',
    'notify_on_assignment_published()',
    'notify_on_attempt_submitted()',
    'notify_on_class_teacher_added()',
    'notify_on_class_textbook_added()',
    'notify_deadline_soon()',
    'trg_notify_parents_on_grade()',
    'trg_notify_parent_assignment_published()',
    'trg_notify_parent_attempt_graded()',
    'trg_send_push_on_notification()',
    'trg_add_xp_practice_session()',
    'trg_add_xp_assignment_submission()',
    '_fanout_broadcast(uuid)',
    '_resolve_broadcast_recipients(notification_broadcasts)',
    'dispatch_scheduled_notifications()',
    'publish_due_lessons()',
    'publish_due_worksheets()',
    'reap_stale_export_jobs()',
    'claim_export_job(text)',
    'add_xp(uuid, integer)',
    'increment_player_score(uuid, integer)',
    'get_login_password(uuid)'
  ];
BEGIN
  FOREACH _fn IN ARRAY _fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM authenticated', _fn);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip revoke on %: %', _fn, SQLERRM;
    END;
  END LOOP;
END $$;
