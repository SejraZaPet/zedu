ALTER TABLE public.academy_courses DROP CONSTRAINT IF EXISTS academy_courses_audience_check;
ALTER TABLE public.academy_courses ADD CONSTRAINT academy_courses_audience_check
  CHECK (audience = ANY (ARRAY['teacher'::text, 'student'::text, 'parent'::text, 'lektor'::text, 'both'::text]));