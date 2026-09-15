CREATE TABLE public.lesson_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  subject text NOT NULL,
  class_id uuid,
  group_id uuid,
  lesson_date date NOT NULL,
  topic text,
  materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lesson_topics_unique_key ON public.lesson_topics (
  teacher_id,
  subject,
  coalesce(class_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lesson_date
);

CREATE INDEX lesson_topics_class_subject_idx ON public.lesson_topics (class_id, subject, lesson_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_topics TO authenticated;
GRANT ALL ON public.lesson_topics TO service_role;

ALTER TABLE public.lesson_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own lesson topics"
ON public.lesson_topics FOR ALL TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Class members can view lesson topics"
ON public.lesson_topics FOR SELECT TO authenticated
USING (
  (class_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.class_members cm
    WHERE cm.class_id = lesson_topics.class_id AND cm.user_id = auth.uid()
  ))
  OR (group_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.subject_group_members sgm
    WHERE sgm.group_id = lesson_topics.group_id AND sgm.student_id = auth.uid()
  ))
);
