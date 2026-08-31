CREATE TABLE public.school_curriculum_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  field_of_study text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  content text,
  file_url text,
  file_name text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_curriculum_documents TO authenticated;
GRANT ALL ON public.school_curriculum_documents TO service_role;

ALTER TABLE public.school_curriculum_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view school curriculum docs"
ON public.school_curriculum_documents FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_school_admin_of(school_id, auth.uid())
  OR school_id = public.get_user_school_id(auth.uid())
);

CREATE POLICY "School admins can insert school curriculum docs"
ON public.school_curriculum_documents FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.is_school_admin_of(school_id, auth.uid()));

CREATE POLICY "School admins can update school curriculum docs"
ON public.school_curriculum_documents FOR UPDATE TO authenticated
USING (public.is_admin() OR public.is_school_admin_of(school_id, auth.uid()))
WITH CHECK (public.is_admin() OR public.is_school_admin_of(school_id, auth.uid()));

CREATE POLICY "School admins can delete school curriculum docs"
ON public.school_curriculum_documents FOR DELETE TO authenticated
USING (public.is_admin() OR public.is_school_admin_of(school_id, auth.uid()));

CREATE TRIGGER update_school_curriculum_documents_updated_at
BEFORE UPDATE ON public.school_curriculum_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_school_curriculum_documents_school ON public.school_curriculum_documents(school_id);

ALTER TABLE public.teacher_curriculum_plans
ADD COLUMN source_school_curriculum_id uuid NULL REFERENCES public.school_curriculum_documents(id) ON DELETE SET NULL;