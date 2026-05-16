DROP POLICY IF EXISTS "Teacher can read own classes" ON public.classes;

CREATE POLICY "Teacher can read own classes"
  ON public.classes FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR created_by = auth.uid()
    OR public.is_class_teacher(id, auth.uid())
  );

DROP POLICY IF EXISTS "Admin/teacher/student can read schedule slots" ON public.class_schedule_slots;

CREATE POLICY "Admin/teacher/student can read schedule slots"
ON public.class_schedule_slots FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.classes c
    WHERE c.id = class_schedule_slots.class_id
      AND c.created_by = auth.uid()
  )
  OR public.is_class_teacher(class_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.class_members cm
    WHERE cm.class_id = class_schedule_slots.class_id AND cm.user_id = auth.uid()
  )
);

INSERT INTO public.class_teachers (class_id, user_id, role)
SELECT c.id, c.created_by, 'owner'
FROM public.classes c
WHERE c.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.class_teachers ct
    WHERE ct.class_id = c.id
      AND ct.user_id = c.created_by
  )
ON CONFLICT (class_id, user_id) DO UPDATE
SET role = 'owner';