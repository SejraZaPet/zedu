DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'can_access_realtime_topic','can_access_school_meeting','can_access_textbooks',
        'can_manage_reservation','can_manage_school_meeting','get_user_school_id',
        'has_staff_permission','is_admin','is_admin_or_teacher','is_class_owner',
        'is_class_teacher','is_enrolled_in_textbook','is_parent_of_student',
        'is_player_in_game_session','is_school_admin','is_school_admin_of',
        'is_teacher_of_game_session','is_teacher_of_student','owns_textbook',
        'resource_in_my_school','has_role','has_elevated_role','is_active_staff',
        'is_school_leadership','can_reserve_resources','is_teaching_unit_collaborator',
        'is_subject_collaborator_of','owns_notebook','owns_subject_group',
        'is_game_session_participant','is_public_shared_textbook','can_manage_credentials'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', r.sig);
  END LOOP;
END $$;