CREATE OR REPLACE FUNCTION public.can_student_view_assigned_worksheet(_ws uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.status = 'published'
      AND (a.worksheet_id = _ws
           OR (a.settings->>'kind' = 'material'
               AND a.settings->'worksheets' @> jsonb_build_array(jsonb_build_object('id', _ws::text))))
      AND (
        (a.class_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = a.class_id AND cm.user_id = _uid))
        OR (a.group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.subject_group_members g WHERE g.group_id = a.group_id AND g.student_id = _uid))
      )
      AND (NOT EXISTS (SELECT 1 FROM public.assignment_recipients r WHERE r.assignment_id = a.id)
           OR EXISTS (SELECT 1 FROM public.assignment_recipients r WHERE r.assignment_id = a.id AND r.student_id = _uid))
  ) $$;
REVOKE ALL ON FUNCTION public.can_student_view_assigned_worksheet(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_student_view_assigned_worksheet(uuid, uuid) TO authenticated;

DROP POLICY "Students can read worksheets via assignment" ON public.worksheets;
CREATE POLICY "Students can read worksheets via assignment" ON public.worksheets
  FOR SELECT TO authenticated USING (public.can_student_view_assigned_worksheet(id, auth.uid()));