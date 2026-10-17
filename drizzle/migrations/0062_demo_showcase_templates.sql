CREATE TABLE public.demo_game_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), seed_key text NOT NULL UNIQUE,
 title text NOT NULL, description text, purpose text DEFAULT 'opakovaci', activity_data jsonb NOT NULL CHECK(jsonb_typeof(activity_data)='array'),
 default_game_mode text NOT NULL DEFAULT 'standard', default_team_mode text NOT NULL DEFAULT 'none', subject text,
 background_url text, default_team_count integer NOT NULL DEFAULT 2 CHECK(default_team_count BETWEEN 2 AND 6),
 team_scoring text NOT NULL DEFAULT 'avg' CHECK(team_scoring IN ('avg','sum')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demo_game_sources TO service_role;
ALTER TABLE public.demo_game_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demo_game_sources FROM PUBLIC,anon,authenticated;
ALTER TABLE public.teacher_game_templates ADD COLUMN demo_pair_id uuid REFERENCES public.demo_pairs(id) ON DELETE CASCADE, ADD COLUMN demo_seed_key text;
CREATE UNIQUE INDEX teacher_game_templates_demo_seed_uq ON public.teacher_game_templates(demo_pair_id,demo_seed_key) WHERE demo_pair_id IS NOT NULL AND demo_seed_key IS NOT NULL;
CREATE OR REPLACE FUNCTION public.demo_fill_game_templates(_pair_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.demo_pairs p WHERE p.id=_pair_id AND public.is_demo_user(p.teacher_user_id) AND NOT EXISTS(SELECT 1 FROM public.demo_shared_users d WHERE d.user_id=p.teacher_user_id)) THEN RETURN 0; END IF;
 INSERT INTO public.teacher_game_templates(teacher_id,title,description,purpose,activity_data,default_game_mode,default_team_mode,subject,background_url,default_team_count,team_scoring,demo_pair_id,demo_seed_key)
 SELECT p.teacher_user_id,s.title,s.description,s.purpose,s.activity_data,s.default_game_mode,s.default_team_mode,s.subject,s.background_url,s.default_team_count,s.team_scoring,p.id,s.seed_key
 FROM public.demo_pairs p CROSS JOIN public.demo_game_sources s WHERE p.id=_pair_id
 ON CONFLICT(demo_pair_id,demo_seed_key) WHERE demo_pair_id IS NOT NULL AND demo_seed_key IS NOT NULL DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.demo_fill_game_templates(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.demo_fill_game_templates(uuid) TO service_role;
CREATE POLICY demo_iso ON public.teacher_game_templates AS RESTRICTIVE FOR ALL TO authenticated
USING (NOT public.is_demo_user(auth.uid()) OR teacher_id=auth.uid())
WITH CHECK (NOT public.is_demo_user(auth.uid()) OR (teacher_id=auth.uid() AND (demo_pair_id IS NULL OR EXISTS(SELECT 1 FROM public.get_my_demo_pair() p WHERE p.my_side='teacher'))));
CREATE POLICY demo_guard_update ON public.teacher_game_templates AS RESTRICTIVE FOR UPDATE TO authenticated
USING (NOT public.is_demo_user(auth.uid()) OR demo_seed_key IS NULL)
WITH CHECK (NOT public.is_demo_user(auth.uid()) OR demo_seed_key IS NULL);
CREATE POLICY demo_guard_delete ON public.teacher_game_templates AS RESTRICTIVE FOR DELETE TO authenticated
USING (NOT public.is_demo_user(auth.uid()) OR demo_seed_key IS NULL);
CREATE POLICY demo_guard_insert ON public.teacher_game_templates AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (NOT public.is_demo_user(auth.uid()) OR (demo_seed_key IS NULL AND demo_pair_id IS NULL));
DO $$ DECLARE body text; BEGIN
 SELECT pg_get_functiondef('public.demo_seed_pair(uuid)'::regprocedure) INTO body;
 IF position('PERFORM public.demo_fill_game_templates(_pair_id);' in body)=0 THEN
 body:=replace(body,'IF p IS NULL THEN RAISE EXCEPTION ''pair_not_found''; END IF;', 'IF p IS NULL THEN RAISE EXCEPTION ''pair_not_found''; END IF;' || chr(10) || '  PERFORM public.demo_fill_game_templates(_pair_id);');
 EXECUTE body;
 END IF;
 SELECT pg_get_functiondef('public.demo_reset_seed()'::regprocedure) INTO body;
 body:=replace(body,'RETURN cnt;', 'PERFORM public.demo_fill_game_templates(p.id) FROM public.demo_pairs p;' || chr(10) || '  RETURN cnt;');
 EXECUTE body;
END $$;
COMMENT ON COLUMN public.teacher_game_templates.demo_seed_key IS 'Stable demo showcase key; pair-owned copies are protected for demo users and omitted from global snapshots.';