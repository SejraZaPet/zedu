ALTER TABLE public.teacher_curriculum_plans
  ADD COLUMN subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  ADD COLUMN group_id uuid REFERENCES public.subject_groups(id) ON DELETE SET NULL;

ALTER TABLE public.teacher_curriculum_plans
  ADD CONSTRAINT teacher_curriculum_plans_target_chk
  CHECK (
    (class_id IS NOT NULL AND group_id IS NULL)
    OR (group_id IS NOT NULL AND class_id IS NULL)
    OR (class_id IS NULL AND group_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_tcp_subject_class_group
  ON public.teacher_curriculum_plans (subject_id, class_id, group_id);

CREATE POLICY "Collaborators can view unit curriculum plans"
ON public.teacher_curriculum_plans
FOR SELECT
TO authenticated
USING (public.is_teaching_unit_collaborator(subject_id, class_id, group_id, auth.uid()));