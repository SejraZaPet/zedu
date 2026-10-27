CREATE TABLE public.preview_students (
  student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.preview_students TO authenticated;
GRANT ALL ON public.preview_students TO service_role;
ALTER TABLE public.preview_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own preview student" ON public.preview_students
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR student_id = auth.uid());
CREATE POLICY demo_guard_preview_students ON public.preview_students AS RESTRICTIVE
  FOR ALL TO authenticated USING (NOT public.is_demo_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_preview_student(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.preview_students WHERE student_id = _uid)
$$;
REVOKE EXECUTE ON FUNCTION public.is_preview_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_preview_student(uuid) TO authenticated, service_role;