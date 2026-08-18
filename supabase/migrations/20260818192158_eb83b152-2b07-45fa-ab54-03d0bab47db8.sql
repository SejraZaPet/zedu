ALTER TABLE public.behavior_points
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.subject_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_behavior_points_subject ON public.behavior_points(subject_id);
CREATE INDEX IF NOT EXISTS idx_behavior_points_group ON public.behavior_points(group_id);