CREATE OR REPLACE FUNCTION public.is_class_linked_textbook(_textbook_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM class_textbooks ct
    JOIN class_members cm ON cm.class_id = ct.class_id
    WHERE ct.textbook_id = _textbook_id AND ct.textbook_type = 'teacher' AND cm.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM class_subjects cs
    JOIN class_members cm ON cm.class_id = cs.class_id
    WHERE cs.textbook_id = _textbook_id AND coalesce(cs.textbook_type, 'teacher') = 'teacher'
      AND cs.archived = false AND cm.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM class_subject_textbooks cst
    JOIN class_subjects cs ON cs.id = cst.class_subject_id
    JOIN class_members cm ON cm.class_id = cs.class_id
    WHERE cst.textbook_id = _textbook_id AND coalesce(cst.textbook_type, 'teacher') = 'teacher'
      AND cs.archived = false AND cm.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM class_schedule_slots s
    JOIN class_members cm ON cm.class_id = s.class_id
    WHERE s.textbook_id = _textbook_id AND coalesce(s.textbook_type, 'teacher') = 'teacher'
      AND cm.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM subject_group_textbooks sgt
    JOIN subject_group_members sgm ON sgm.group_id = sgt.subject_group_id
    WHERE sgt.textbook_id = _textbook_id AND coalesce(sgt.textbook_type, 'teacher') = 'teacher'
      AND sgm.student_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Students can read class-linked teacher textbooks" ON public.teacher_textbooks;
CREATE POLICY "Students can read class-linked teacher textbooks"
ON public.teacher_textbooks FOR SELECT TO authenticated
USING (public.is_class_linked_textbook(id, auth.uid()));

DROP POLICY IF EXISTS "Students can read class-linked teacher textbook lessons" ON public.teacher_textbook_lessons;
CREATE POLICY "Students can read class-linked teacher textbook lessons"
ON public.teacher_textbook_lessons FOR SELECT TO authenticated
USING (public.is_class_linked_textbook(textbook_id, auth.uid()));