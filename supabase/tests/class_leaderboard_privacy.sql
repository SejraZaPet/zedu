-- Run against the agent-created [TEST] Liga showcase fixture only. Always rolls back.
BEGIN;
SELECT set_config('request.jwt.claim.sub','34da0302-c924-46f7-ae26-74dff648312b',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.class_leaderboard_student('f1000000-0000-4000-8000-000000000002');
 IF n<>11 THEN RAISE EXCEPTION 'Expected top ten and own rank 11'; END IF;
 IF EXISTS(SELECT 1 FROM public.class_leaderboard_student('f1000000-0000-4000-8000-000000000002') WHERE NOT is_me AND (rank>10 OR display_name<>'Anonymní žák' OR avatar_user_id IS NOT NULL)) THEN RAISE EXCEPTION 'Peer details exposed'; END IF;
 SELECT count(*) INTO n FROM public.class_leaderboard('f1000000-0000-4000-8000-000000000002');
 IF n<>11 THEN RAISE EXCEPTION 'Legacy bypass exposed all members'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id='e3b2b0c0-5ce5-4f54-a45a-8b83e28d66cd') THEN RAISE EXCEPTION 'Other profile exposed'; END IF;
 IF EXISTS(SELECT 1 FROM public.class_leaderboard_baselines WHERE class_id='f1000000-0000-4000-8000-000000000002' AND student_id<>auth.uid()) THEN RAISE EXCEPTION 'Other baseline exposed'; END IF;
 IF EXISTS(SELECT 1 FROM public.class_leaderboard_student('9b79c626-edbb-42e9-aaa5-0239bc06b3d4')) THEN RAISE EXCEPTION 'Outsider class exposed'; END IF;
 IF has_function_privilege('authenticated','public.add_xp(uuid,integer,text,text)','execute') THEN RAISE EXCEPTION 'XP writable by client'; END IF;
 IF has_function_privilege('anon','public.class_leaderboard(uuid)','execute') THEN RAISE EXCEPTION 'Anonymous leaderboard callable'; END IF;
END $$;
RESET ROLE;
ROLLBACK;