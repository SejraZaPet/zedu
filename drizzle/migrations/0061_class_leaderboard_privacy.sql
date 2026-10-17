CREATE OR REPLACE FUNCTION public.class_leaderboard_student(_class_id uuid)
RETURNS TABLE(rank integer, display_name text, student_id uuid, xp integer, level integer, badge_count bigint, is_me boolean, avatar_user_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _anonymous boolean; _mode text;
BEGIN
 IF _me IS NULL OR NOT EXISTS (SELECT 1 FROM public.class_members WHERE class_id=_class_id AND user_id=_me) THEN RETURN; END IF;
 IF public.is_demo_user(_me) AND NOT public.demo_can_see_class(_class_id) THEN RETURN; END IF;
 SELECT c.leaderboard_anonymous, COALESCE(s.league_name_mode,'initial') INTO _anonymous,_mode
 FROM public.classes c LEFT JOIN public.schools s ON s.id=c.school_id WHERE c.id=_class_id AND c.leaderboard_enabled;
 IF NOT FOUND THEN RETURN; END IF;
 RETURN QUERY WITH members AS (
 SELECT cm.user_id AS sid, greatest(0,coalesce(x.total_xp,0)-coalesce(b.baseline_xp,0))::int AS points,coalesce(x.level,1) AS lvl,
 (SELECT count(*) FROM public.student_badges sb WHERE sb.student_id=cm.user_id) AS badges
 FROM public.class_members cm LEFT JOIN public.student_xp x ON x.student_id=cm.user_id
 LEFT JOIN public.class_leaderboard_baselines b ON b.class_id=cm.class_id AND b.student_id=cm.user_id
 WHERE cm.class_id=_class_id AND (NOT public.is_demo_user(_me) OR public.demo_can_see_user(cm.user_id))
 ), ranked AS (SELECT m.*, row_number() OVER (ORDER BY m.points DESC,m.sid)::int AS pos FROM members m)
 SELECT r.pos, CASE WHEN coalesce(_anonymous,false) AND r.sid<>_me THEN 'Anonymní žák' ELSE public.league_display_name(r.sid,_mode) END,
 r.sid,r.points,r.lvl,r.badges,r.sid=_me, CASE WHEN coalesce(_anonymous,false) AND r.sid<>_me THEN NULL::uuid ELSE r.sid END
 FROM ranked r WHERE (r.pos<=10 AND r.points>0) OR r.sid=_me ORDER BY r.pos;
END $$;
REVOKE ALL ON FUNCTION public.class_leaderboard_student(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.class_leaderboard_student(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.class_leaderboard(_class_id uuid)
RETURNS TABLE(student_id uuid,total_xp integer,level integer,badge_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RETURN; END IF;
 IF public.is_demo_user(auth.uid()) AND NOT public.demo_can_see_class(_class_id) THEN RETURN; END IF;
 IF public.is_admin() OR public.is_class_teacher(_class_id,auth.uid()) THEN
 RETURN QUERY SELECT cm.user_id,coalesce(x.total_xp,0),coalesce(x.level,1),(SELECT count(*) FROM public.student_badges b WHERE b.student_id=cm.user_id)
 FROM public.class_members cm LEFT JOIN public.student_xp x ON x.student_id=cm.user_id
 WHERE cm.class_id=_class_id AND (NOT public.is_demo_user(auth.uid()) OR public.demo_can_see_user(cm.user_id));
 ELSE
 RETURN QUERY SELECT r.student_id,r.xp,r.level,r.badge_count FROM public.class_leaderboard_student(_class_id) r;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.class_leaderboard(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.class_leaderboard(uuid) TO authenticated,service_role;
CREATE POLICY leaderboard_baseline_privacy ON public.class_leaderboard_baselines AS RESTRICTIVE FOR SELECT TO authenticated
USING (student_id=auth.uid() OR public.is_admin() OR public.is_class_teacher(class_id,auth.uid()));