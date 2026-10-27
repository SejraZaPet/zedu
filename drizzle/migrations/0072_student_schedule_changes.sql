ALTER TABLE public.schedule_exceptions ADD COLUMN reason_visible boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.student_schedule_changes(_from date, _to date)
RETURNS TABLE(id uuid, source_kind text, source_id text, class_slot_id uuid, original_date date,
  action text, new_date date, new_start time, new_end time, class_id uuid, group_id uuid, public_reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.source_kind, e.source_id, e.class_slot_id, e.original_date, e.action,
    e.new_date, e.new_start, e.new_end, e.class_id, e.group_id,
    CASE WHEN e.reason_visible THEN coalesce(e.public_reason, '') ELSE '' END
  FROM public.schedule_exceptions e
  WHERE e.state = 'active' AND e.visible_to_students
    AND (e.original_date BETWEEN _from AND _to OR e.new_date BETWEEN _from AND _to)
    AND public.schedule_demo_access(e.owner_id, e.class_id, e.group_id)
    AND (
      EXISTS (SELECT 1 FROM public.class_members m WHERE m.class_id = e.class_id AND m.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.subject_group_members g WHERE g.group_id = e.group_id AND g.student_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.parent_student_links l
        JOIN public.class_members m ON m.user_id = l.student_id
        WHERE l.parent_id = auth.uid() AND m.class_id = e.class_id)
      OR EXISTS (SELECT 1 FROM public.parent_student_links l
        JOIN public.subject_group_members g ON g.student_id = l.student_id
        WHERE l.parent_id = auth.uid() AND g.group_id = e.group_id)
    )
$$;
REVOKE EXECUTE ON FUNCTION public.student_schedule_changes(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_schedule_changes(date, date) TO authenticated;