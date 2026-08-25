CREATE TABLE public.school_leadership_delegates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.school_leadership_delegates TO authenticated;
GRANT ALL ON public.school_leadership_delegates TO service_role;
ALTER TABLE public.school_leadership_delegates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view delegates" ON public.school_leadership_delegates
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()) OR public.is_school_admin_of(school_id, auth.uid()));

CREATE POLICY "School admins manage delegates" ON public.school_leadership_delegates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_school_admin_of(school_id, auth.uid()));

CREATE POLICY "School admins remove delegates" ON public.school_leadership_delegates
  FOR DELETE TO authenticated
  USING (public.is_school_admin_of(school_id, auth.uid()));

-- Vedení = školní admin nebo delegovaný učitel dané školy
CREATE OR REPLACE FUNCTION public.is_school_leadership(_school_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_school_admin_of(_school_id, _user_id)
    OR EXISTS (
      SELECT 1 FROM public.school_leadership_delegates d
      WHERE d.school_id = _school_id AND d.user_id = _user_id
    );
$$;

-- Delegáti mohou upravovat a mazat zápisy z porad své školy
CREATE POLICY "School leadership can update meetings" ON public.school_meetings
  FOR UPDATE TO authenticated
  USING (public.is_school_leadership(school_id, auth.uid()))
  WITH CHECK (public.is_school_leadership(school_id, auth.uid()));

CREATE POLICY "School leadership can delete meetings" ON public.school_meetings
  FOR DELETE TO authenticated
  USING (public.is_school_leadership(school_id, auth.uid()));

-- Delegáti mohou spravovat úkoly z porad své školy
CREATE POLICY "School leadership can manage meeting tasks" ON public.school_meeting_tasks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.school_meetings m
      WHERE m.id = meeting_id AND public.is_school_leadership(m.school_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.school_meetings m
      WHERE m.id = meeting_id AND public.is_school_leadership(m.school_id, auth.uid())
    )
  );

-- Kontrola splnění úkolů: jen pro vedení školy; čte stav propojených todos bez rozšíření RLS na todos
CREATE OR REPLACE FUNCTION public.meeting_task_completions(_meeting_id uuid)
RETURNS TABLE(task_id uuid, done boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, (td.status = 'done')
  FROM public.school_meeting_tasks t
  JOIN public.school_meetings m ON m.id = t.meeting_id
  LEFT JOIN public.todos td ON td.id = t.todo_id
  WHERE t.meeting_id = _meeting_id
    AND public.is_school_leadership(m.school_id, auth.uid());
$$;