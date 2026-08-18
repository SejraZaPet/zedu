-- ČÁST 1: group_id na rozvrhových slotech (aditivní)
ALTER TABLE public.class_schedule_slots
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.subject_groups(id) ON DELETE CASCADE;

ALTER TABLE public.class_schedule_slots ALTER COLUMN class_id DROP NOT NULL;

ALTER TABLE public.class_schedule_slots
  ADD CONSTRAINT class_schedule_slots_target_chk
  CHECK (
    (class_id IS NOT NULL AND group_id IS NULL)
    OR (class_id IS NULL AND group_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS class_schedule_slots_group_id_idx
  ON public.class_schedule_slots(group_id);

-- RLS pro slotů skupin (stávající policies pro class_id zůstávají nedotčené)
CREATE POLICY "Group owner can read group schedule slots"
ON public.class_schedule_slots FOR SELECT TO authenticated
USING (group_id IS NOT NULL AND (
  public.owns_subject_group(group_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.subject_group_members m
             WHERE m.group_id = class_schedule_slots.group_id AND m.student_id = auth.uid())
));

CREATE POLICY "Group owner can insert group schedule slots"
ON public.class_schedule_slots FOR INSERT TO authenticated
WITH CHECK (group_id IS NOT NULL AND (public.owns_subject_group(group_id, auth.uid()) OR public.is_admin()));

CREATE POLICY "Group owner can update group schedule slots"
ON public.class_schedule_slots FOR UPDATE TO authenticated
USING (group_id IS NOT NULL AND (public.owns_subject_group(group_id, auth.uid()) OR public.is_admin()))
WITH CHECK (group_id IS NOT NULL AND (public.owns_subject_group(group_id, auth.uid()) OR public.is_admin()));

CREATE POLICY "Group owner can delete group schedule slots"
ON public.class_schedule_slots FOR DELETE TO authenticated
USING (group_id IS NOT NULL AND (public.owns_subject_group(group_id, auth.uid()) OR public.is_admin()));

-- ČÁST 3: group_id na zadáních (aditivní)
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.subject_groups(id) ON DELETE SET NULL;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_target_chk
  CHECK (NOT (class_id IS NOT NULL AND group_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS assignments_group_id_idx ON public.assignments(group_id);

-- Žáci skupiny vidí publikovaná zadání své skupiny
CREATE POLICY "Students can read group assignments"
ON public.assignments FOR SELECT TO authenticated
USING (status = 'published' AND group_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.subject_group_members m
  WHERE m.group_id = assignments.group_id AND m.student_id = auth.uid()
));

-- Zpřísnění stávající "classless" větve tak, aby nezpřístupňovala zadání skupin
-- (žádný existující řádek nemá group_id, takže se dnešní chování nemění)
DROP POLICY IF EXISTS "Students can read assigned assignments" ON public.assignments;
CREATE POLICY "Students can read assigned assignments"
ON public.assignments FOR SELECT
USING (
  status = 'published' AND (
    (class_id IS NULL AND group_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.class_members cm
               WHERE cm.class_id = assignments.class_id AND cm.user_id = auth.uid())
  )
);

-- ČÁST 4: založení dvou skupin odpovídajících "nálepkovým" třídám (třídy zůstávají)
INSERT INTO public.subject_groups (subject_id, name, school_year, created_by)
SELECT 'e28252d3-98bd-4e66-b57b-80bf13b630c1', v.name, '2026/2027', '0be3aeeb-2703-4b11-9638-9f2d7cb2b5d9'
FROM (VALUES ('Č1.A + Č3.A dívky'), ('Č1.A + Č3.A chlapci')) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.subject_groups g WHERE g.name = v.name
);