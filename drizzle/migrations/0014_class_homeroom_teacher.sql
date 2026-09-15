-- Nejvýše jeden třídní učitel na třídu
CREATE UNIQUE INDEX IF NOT EXISTS class_teachers_one_homeroom_per_class
  ON public.class_teachers (class_id)
  WHERE role = 'homeroom';

-- Školní admin může spravovat učitele tříd své školy (stejná konvence jako is_school_admin_of jinde)
CREATE POLICY "School admins can read class_teachers"
  ON public.class_teachers FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = class_teachers.class_id
      AND c.school_id IS NOT NULL
      AND public.is_school_admin_of(c.school_id, auth.uid())
  ));

CREATE POLICY "School admins can insert class_teachers"
  ON public.class_teachers FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = class_teachers.class_id
      AND c.school_id IS NOT NULL
      AND public.is_school_admin_of(c.school_id, auth.uid())
  ));

CREATE POLICY "School admins can delete class_teachers"
  ON public.class_teachers FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = class_teachers.class_id
      AND c.school_id IS NOT NULL
      AND public.is_school_admin_of(c.school_id, auth.uid())
  ));
