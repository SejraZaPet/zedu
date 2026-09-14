ALTER TABLE public.academy_courses DROP CONSTRAINT IF EXISTS academy_courses_audience_check;
ALTER TABLE public.academy_courses ADD CONSTRAINT academy_courses_audience_check CHECK (audience = ANY (ARRAY['teacher','student','parent','lektor','both','internal']::text[]));

DROP POLICY IF EXISTS "Anyone auth can view published courses" ON public.academy_courses;
CREATE POLICY "Anyone auth can view published courses"
ON public.academy_courses
FOR SELECT
TO authenticated
USING (
  (is_published = true AND audience <> 'internal')
  OR public.is_admin()
  OR (audience = 'internal' AND public.is_active_staff(auth.uid()))
);

DROP POLICY IF EXISTS "View modules of published courses" ON public.academy_modules;
CREATE POLICY "View modules of published courses"
ON public.academy_modules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.academy_courses c
    WHERE c.id = academy_modules.course_id
      AND (
        (c.is_published = true AND c.audience <> 'internal')
        OR public.is_admin()
        OR (c.audience = 'internal' AND public.is_active_staff(auth.uid()))
      )
  )
);