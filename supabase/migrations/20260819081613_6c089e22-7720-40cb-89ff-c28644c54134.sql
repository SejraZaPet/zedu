CREATE TABLE public.class_subject_textbooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_subject_id uuid NOT NULL REFERENCES public.class_subjects(id) ON DELETE CASCADE,
  textbook_id uuid NOT NULL,
  textbook_type text NOT NULL DEFAULT 'teacher',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_subject_id, textbook_id, textbook_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_subject_textbooks TO authenticated;
GRANT ALL ON public.class_subject_textbooks TO service_role;

ALTER TABLE public.class_subject_textbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read class_subject_textbooks"
ON public.class_subject_textbooks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.class_subjects cs
  WHERE cs.id = class_subject_textbooks.class_subject_id
    AND (public.is_admin() OR public.is_class_teacher(cs.class_id, auth.uid())
      OR EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = cs.class_id AND cm.user_id = auth.uid()))
));

CREATE POLICY "Insert class_subject_textbooks"
ON public.class_subject_textbooks FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.class_subjects cs
  WHERE cs.id = class_subject_textbooks.class_subject_id
    AND (public.is_admin() OR public.is_class_teacher(cs.class_id, auth.uid()))
));

CREATE POLICY "Update class_subject_textbooks"
ON public.class_subject_textbooks FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.class_subjects cs
  WHERE cs.id = class_subject_textbooks.class_subject_id
    AND (public.is_admin() OR public.is_class_teacher(cs.class_id, auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.class_subjects cs
  WHERE cs.id = class_subject_textbooks.class_subject_id
    AND (public.is_admin() OR public.is_class_teacher(cs.class_id, auth.uid()))
));

CREATE POLICY "Delete class_subject_textbooks"
ON public.class_subject_textbooks FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.class_subjects cs
  WHERE cs.id = class_subject_textbooks.class_subject_id
    AND (public.is_admin() OR public.is_class_teacher(cs.class_id, auth.uid()))
));

CREATE INDEX idx_cst_class_subject ON public.class_subject_textbooks(class_subject_id);

CREATE TABLE public.subject_group_textbooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_group_id uuid NOT NULL REFERENCES public.subject_groups(id) ON DELETE CASCADE,
  textbook_id uuid NOT NULL,
  textbook_type text NOT NULL DEFAULT 'teacher',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_group_id, textbook_id, textbook_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_group_textbooks TO authenticated;
GRANT ALL ON public.subject_group_textbooks TO service_role;

ALTER TABLE public.subject_group_textbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read subject_group_textbooks"
ON public.subject_group_textbooks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.subject_groups g
  WHERE g.id = subject_group_textbooks.subject_group_id
    AND (public.is_admin() OR g.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.subject_group_members m WHERE m.group_id = g.id AND m.student_id = auth.uid()))
));

CREATE POLICY "Insert subject_group_textbooks"
ON public.subject_group_textbooks FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.subject_groups g
  WHERE g.id = subject_group_textbooks.subject_group_id
    AND (public.is_admin() OR g.created_by = auth.uid())
));

CREATE POLICY "Update subject_group_textbooks"
ON public.subject_group_textbooks FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.subject_groups g
  WHERE g.id = subject_group_textbooks.subject_group_id
    AND (public.is_admin() OR g.created_by = auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.subject_groups g
  WHERE g.id = subject_group_textbooks.subject_group_id
    AND (public.is_admin() OR g.created_by = auth.uid())
));

CREATE POLICY "Delete subject_group_textbooks"
ON public.subject_group_textbooks FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.subject_groups g
  WHERE g.id = subject_group_textbooks.subject_group_id
    AND (public.is_admin() OR g.created_by = auth.uid())
));

CREATE INDEX idx_sgt_group ON public.subject_group_textbooks(subject_group_id);

INSERT INTO public.class_subject_textbooks (class_subject_id, textbook_id, textbook_type, is_primary)
SELECT cs.id, cs.textbook_id, COALESCE(cs.textbook_type, 'teacher'), true
FROM public.class_subjects cs
WHERE cs.textbook_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.subject_group_textbooks (subject_group_id, textbook_id, textbook_type, is_primary)
SELECT g.id, g.textbook_id, COALESCE(g.textbook_type, 'teacher'), true
FROM public.subject_groups g
WHERE g.textbook_id IS NOT NULL
ON CONFLICT DO NOTHING;