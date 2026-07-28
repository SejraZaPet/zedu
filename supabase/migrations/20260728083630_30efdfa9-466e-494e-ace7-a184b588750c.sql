CREATE TABLE public.behavior_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('spoluprace','ohleduplnost','aktivni_zapojeni','samostatnost','pomoc_druhym')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX behavior_points_student_idx ON public.behavior_points(student_id, created_at DESC);
CREATE INDEX behavior_points_teacher_idx ON public.behavior_points(teacher_id, created_at DESC);
CREATE INDEX behavior_points_class_idx ON public.behavior_points(class_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.behavior_points TO authenticated;
GRANT ALL ON public.behavior_points TO service_role;

ALTER TABLE public.behavior_points ENABLE ROW LEVEL SECURITY;

-- Teacher inserts own records
CREATE POLICY "Teachers insert own behavior points"
ON public.behavior_points FOR INSERT
TO authenticated
WITH CHECK (teacher_id = auth.uid());

-- Teacher can update/delete own records (in case of correction)
CREATE POLICY "Teachers modify own behavior points"
ON public.behavior_points FOR UPDATE
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers delete own behavior points"
ON public.behavior_points FOR DELETE
TO authenticated
USING (teacher_id = auth.uid());

-- Student sees own
CREATE POLICY "Students see own behavior points"
ON public.behavior_points FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Teacher who authored sees them
CREATE POLICY "Teachers see own authored behavior points"
ON public.behavior_points FOR SELECT
TO authenticated
USING (teacher_id = auth.uid());

-- Teachers see behavior points for students in their classes
CREATE POLICY "Teachers see behavior points for their class members"
ON public.behavior_points FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.class_members cm
    JOIN public.classes c ON c.id = cm.class_id
    WHERE cm.user_id = behavior_points.student_id
      AND c.created_by = auth.uid()
  )
);

-- Parents see behavior points of linked children
CREATE POLICY "Parents see behavior points of linked child"
ON public.behavior_points FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parent_student_links psl
    WHERE psl.parent_id = auth.uid()
      AND psl.student_id = behavior_points.student_id
  )
);

-- Admins full access
CREATE POLICY "Admins manage all behavior points"
ON public.behavior_points FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());