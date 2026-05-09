CREATE TABLE public.parent_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('parent_to_teacher', 'teacher_to_parent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_parent_messages_parent ON public.parent_messages(parent_id, created_at DESC);
CREATE INDEX idx_parent_messages_teacher ON public.parent_messages(teacher_id, created_at DESC);
CREATE INDEX idx_parent_messages_student ON public.parent_messages(student_id);

ALTER TABLE public.parent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can read own messages"
ON public.parent_messages FOR SELECT TO authenticated
USING (parent_id = auth.uid());

CREATE POLICY "Teachers can read own messages"
ON public.parent_messages FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "Admins can read all messages"
ON public.parent_messages FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "Parents can send messages"
ON public.parent_messages FOR INSERT TO authenticated
WITH CHECK (parent_id = auth.uid() AND direction = 'parent_to_teacher');

CREATE POLICY "Teachers can send messages"
ON public.parent_messages FOR INSERT TO authenticated
WITH CHECK (teacher_id = auth.uid() AND direction = 'teacher_to_parent');

CREATE POLICY "Recipients can mark messages read"
ON public.parent_messages FOR UPDATE TO authenticated
USING (
  (direction = 'teacher_to_parent' AND parent_id = auth.uid())
  OR (direction = 'parent_to_teacher' AND teacher_id = auth.uid())
)
WITH CHECK (
  (direction = 'teacher_to_parent' AND parent_id = auth.uid())
  OR (direction = 'parent_to_teacher' AND teacher_id = auth.uid())
);

CREATE POLICY "Admins can manage messages"
ON public.parent_messages FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());