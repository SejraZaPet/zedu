-- Add school_id to classes (no FK yet, prepared for phase 4)
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS school_id uuid;

-- Create class_schedule_slots
CREATE TABLE IF NOT EXISTS public.class_schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  week_parity text NOT NULL DEFAULT 'every' CHECK (week_parity IN ('every', 'odd', 'even')),
  room text DEFAULT '',
  subject_label text DEFAULT '',
  valid_from date,
  valid_to date,
  bell_period_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_schedule_slots_time_chk CHECK (end_time > start_time),
  CONSTRAINT class_schedule_slots_validity_chk CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_class_schedule_slots_class_id ON public.class_schedule_slots(class_id);

CREATE TRIGGER trg_class_schedule_slots_updated_at
BEFORE UPDATE ON public.class_schedule_slots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.class_schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/teacher/student can read schedule slots"
ON public.class_schedule_slots FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.is_class_teacher(class_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.class_members cm
    WHERE cm.class_id = class_schedule_slots.class_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Admin or class teacher can insert schedule slots"
ON public.class_schedule_slots FOR INSERT
TO authenticated
WITH CHECK (public.is_class_teacher(class_id, auth.uid()) OR public.is_admin());

CREATE POLICY "Admin or class teacher can update schedule slots"
ON public.class_schedule_slots FOR UPDATE
TO authenticated
USING (public.is_class_teacher(class_id, auth.uid()) OR public.is_admin());

CREATE POLICY "Admin or class teacher can delete schedule slots"
ON public.class_schedule_slots FOR DELETE
TO authenticated
USING (public.is_class_teacher(class_id, auth.uid()) OR public.is_admin());