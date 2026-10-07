-- Test ensure_my_course_notebooks(): běží v transakci a vždy skončí výjimkou (ROLLBACK) s výsledky.
-- Očekávání: created2=0 (idempotence), group>=1, class>=1, otherB beze změny, shared demo/teacher = 0.
DO $$
DECLARE a uuid; b uuid; s uuid; c1 int; c2 int; n_b0 int; n_b1 int; grp int; cls int; sd int;
BEGIN
  SELECT m.student_id INTO a FROM subject_group_members m
   WHERE EXISTS (SELECT 1 FROM class_members cm JOIN class_schedule_slots sl ON sl.class_id=cm.class_id
                 AND sl.group_id IS NULL AND sl.subject_id IS NOT NULL WHERE cm.user_id=m.student_id)
     AND NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id=m.student_id AND r.role IN ('teacher','admin','school_admin','lektor'))
   LIMIT 1;
  SELECT cm.user_id INTO b FROM class_members cm WHERE cm.user_id<>a LIMIT 1;
  SELECT count(*) INTO n_b0 FROM notebooks WHERE owner_id=b;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
  c1 := public.ensure_my_course_notebooks();
  c2 := public.ensure_my_course_notebooks();
  SELECT count(*) FILTER (WHERE related_group_id IS NOT NULL),
         count(*) FILTER (WHERE related_group_id IS NULL AND subject_id IS NOT NULL) INTO grp, cls
    FROM notebooks WHERE owner_id=a;
  SELECT count(*) INTO n_b1 FROM notebooks WHERE owner_id=b;
  SELECT user_id INTO s FROM demo_shared_users LIMIT 1;
  sd := public._ensure_course_notebooks_for(s);
  RAISE EXCEPTION 'TEST created1=% created2=% group=% class=% otherB %->% shared_demo=%', c1, c2, grp, cls, n_b0, n_b1, sd;
END $$;
