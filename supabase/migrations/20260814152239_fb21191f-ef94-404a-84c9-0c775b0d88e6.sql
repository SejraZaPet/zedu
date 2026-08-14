-- === subjects ===
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6EC6D9',
  abbreviation text,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read subjects"
ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teachers can create subjects"
ON public.subjects FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_teacher() AND created_by = auth.uid());
CREATE POLICY "Owner or admin can update subjects"
ON public.subjects FOR UPDATE TO authenticated
USING (public.is_admin() OR created_by = auth.uid())
WITH CHECK (public.is_admin() OR created_by = auth.uid());
CREATE POLICY "Owner or admin can delete subjects"
ON public.subjects FOR DELETE TO authenticated
USING (public.is_admin() OR created_by = auth.uid());

CREATE TRIGGER update_subjects_updated_at
BEFORE UPDATE ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_name_school
ON public.subjects (lower(name), COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- === class_subjects ===
CREATE TABLE IF NOT EXISTS public.class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  school_year text NOT NULL DEFAULT '2026/2027',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_subjects TO authenticated;
GRANT ALL ON public.class_subjects TO service_role;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Class teachers can read class_subjects"
ON public.class_subjects FOR SELECT TO authenticated
USING (public.is_admin() OR public.is_class_teacher(class_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = class_subjects.class_id AND cm.user_id = auth.uid()));
CREATE POLICY "Class teachers can insert class_subjects"
ON public.class_subjects FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.is_class_teacher(class_id, auth.uid()));
CREATE POLICY "Class teachers can update class_subjects"
ON public.class_subjects FOR UPDATE TO authenticated
USING (public.is_admin() OR public.is_class_teacher(class_id, auth.uid()))
WITH CHECK (public.is_admin() OR public.is_class_teacher(class_id, auth.uid()));
CREATE POLICY "Class teachers can delete class_subjects"
ON public.class_subjects FOR DELETE TO authenticated
USING (public.is_admin() OR public.is_class_teacher(class_id, auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS idx_class_subjects_unique
ON public.class_subjects (class_id, subject_id, school_year);

-- === subject_groups ===
CREATE TABLE IF NOT EXISTS public.subject_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  school_year text NOT NULL DEFAULT '2026/2027',
  archived boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_groups TO authenticated;
GRANT ALL ON public.subject_groups TO service_role;
ALTER TABLE public.subject_groups ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_subject_group(_group_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.subject_groups g WHERE g.id = _group_id AND g.created_by = _user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.owns_subject_group(uuid, uuid) FROM anon;

CREATE POLICY "Teachers can create subject_groups"
ON public.subject_groups FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_teacher() AND created_by = auth.uid());
CREATE POLICY "Owner or admin can update subject_groups"
ON public.subject_groups FOR UPDATE TO authenticated
USING (public.is_admin() OR created_by = auth.uid())
WITH CHECK (public.is_admin() OR created_by = auth.uid());
CREATE POLICY "Owner or admin can delete subject_groups"
ON public.subject_groups FOR DELETE TO authenticated
USING (public.is_admin() OR created_by = auth.uid());

-- === subject_group_members ===
CREATE TABLE IF NOT EXISTS public.subject_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.subject_groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_group_members TO authenticated;
GRANT ALL ON public.subject_group_members TO service_role;
ALTER TABLE public.subject_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group owner or member can read members"
ON public.subject_group_members FOR SELECT TO authenticated
USING (public.is_admin() OR public.owns_subject_group(group_id, auth.uid()) OR student_id = auth.uid());
CREATE POLICY "Group owner can insert members"
ON public.subject_group_members FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.owns_subject_group(group_id, auth.uid()));
CREATE POLICY "Group owner can delete members"
ON public.subject_group_members FOR DELETE TO authenticated
USING (public.is_admin() OR public.owns_subject_group(group_id, auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS idx_subject_group_members_unique
ON public.subject_group_members (group_id, student_id);

CREATE POLICY "Owner or admin can read subject_groups"
ON public.subject_groups FOR SELECT TO authenticated
USING (public.is_admin() OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.subject_group_members m WHERE m.group_id = subject_groups.id AND m.student_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON public.class_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_subject_groups_subject ON public.subject_groups(subject_id);

-- === BACKFILL 1: katalog předmětů ===
INSERT INTO public.subjects (name, color, abbreviation, created_by)
SELECT ts.label, COALESCE(ts.color, '#6EC6D9'), ts.abbreviation, ts.created_by
FROM public.textbook_subjects ts
WHERE NOT EXISTS (
  SELECT 1 FROM public.subjects s
  WHERE lower(s.name) = lower(ts.label) AND s.school_id IS NULL
)
ON CONFLICT DO NOTHING;

-- === BACKFILL 2: předměty z rozvrhu + vazba na třídy ===
INSERT INTO public.subjects (name, created_by)
SELECT DISTINCT trim(css.subject_label), NULL::uuid
FROM public.class_schedule_slots css
WHERE css.subject_label IS NOT NULL AND trim(css.subject_label) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.subjects s
    WHERE lower(s.name) = lower(trim(css.subject_label)) AND s.school_id IS NULL
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.class_subjects (class_id, subject_id, school_year)
SELECT DISTINCT css.class_id, s.id, '2026/2027'
FROM public.class_schedule_slots css
JOIN public.subjects s ON lower(s.name) = lower(trim(css.subject_label)) AND s.school_id IS NULL
WHERE css.class_id IS NOT NULL
  AND css.subject_label IS NOT NULL AND trim(css.subject_label) <> ''
ON CONFLICT DO NOTHING;