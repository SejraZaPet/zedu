CREATE TABLE public.assignment_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.assignment_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.assignment_groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  UNIQUE (group_id, student_id)
);

CREATE INDEX idx_assignment_groups_assignment ON public.assignment_groups(assignment_id);
CREATE INDEX idx_assignment_group_members_student ON public.assignment_group_members(student_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_groups TO authenticated;
GRANT ALL ON public.assignment_groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_group_members TO authenticated;
GRANT ALL ON public.assignment_group_members TO service_role;

ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS group_mode text DEFAULT 'individual';
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS group_size integer;

ALTER TABLE public.assignment_attempts ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.assignment_groups(id);
ALTER TABLE public.assignment_attempts ADD COLUMN IF NOT EXISTS last_edited_by uuid;
ALTER TABLE public.assignment_attempts ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

-- Helper: je uživatel členem skupiny úkolu? (SECURITY DEFINER kvůli RLS rekurzi)
CREATE OR REPLACE FUNCTION public.is_assignment_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _group_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.assignment_group_members m
    WHERE m.group_id = _group_id AND m.student_id = _user_id
  )
$$;

ALTER TABLE public.assignment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own assignment groups"
ON public.assignment_groups FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_groups.assignment_id AND a.teacher_id = auth.uid()) OR public.is_admin())
WITH CHECK (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_groups.assignment_id AND a.teacher_id = auth.uid()) OR public.is_admin());

CREATE POLICY "Students read own assignment groups"
ON public.assignment_groups FOR SELECT TO authenticated
USING (public.is_assignment_group_member(assignment_groups.id, auth.uid()));

CREATE POLICY "Teachers manage own assignment group members"
ON public.assignment_group_members FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.assignment_groups g
  JOIN public.assignments a ON a.id = g.assignment_id
  WHERE g.id = assignment_group_members.group_id AND a.teacher_id = auth.uid()
) OR public.is_admin())
WITH CHECK (EXISTS (
  SELECT 1 FROM public.assignment_groups g
  JOIN public.assignments a ON a.id = g.assignment_id
  WHERE g.id = assignment_group_members.group_id AND a.teacher_id = auth.uid()
) OR public.is_admin());

CREATE POLICY "Students read own assignment group membership"
ON public.assignment_group_members FOR SELECT TO authenticated
USING (public.is_assignment_group_member(assignment_group_members.group_id, auth.uid()));

-- Rozšíření studentských politik na assignment_attempts o členství ve skupině
DROP POLICY IF EXISTS "Students can read own attempts" ON public.assignment_attempts;
CREATE POLICY "Students can read own attempts"
ON public.assignment_attempts FOR SELECT TO authenticated
USING (auth.uid() = student_id OR public.is_assignment_group_member(assignment_attempts.group_id, auth.uid()));

DROP POLICY IF EXISTS "Students can insert own attempts" ON public.assignment_attempts;
CREATE POLICY "Students can insert own attempts"
ON public.assignment_attempts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = student_id OR public.is_assignment_group_member(assignment_attempts.group_id, auth.uid()));

DROP POLICY IF EXISTS "Students can update own attempts" ON public.assignment_attempts;
CREATE POLICY "Students can update own attempts"
ON public.assignment_attempts FOR UPDATE TO authenticated
USING ((auth.uid() = student_id OR public.is_assignment_group_member(assignment_attempts.group_id, auth.uid())) AND status = 'in_progress')
WITH CHECK ((auth.uid() = student_id OR public.is_assignment_group_member(assignment_attempts.group_id, auth.uid())) AND status = ANY (ARRAY['in_progress','submitted']));
