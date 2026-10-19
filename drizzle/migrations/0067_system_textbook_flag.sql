ALTER TABLE public.teacher_textbooks ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.teacher_textbooks.is_system IS 'System textbook: readable by all teachers, writable only by admin.';

CREATE OR REPLACE FUNCTION public.tg_guard_textbook_is_system()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND NEW.is_system THEN
    RAISE EXCEPTION 'Systémovou učebnici může založit jen správce.';
  ELSIF TG_OP = 'UPDATE' AND NEW.is_system IS DISTINCT FROM OLD.is_system THEN
    RAISE EXCEPTION 'Příznak systémové učebnice může měnit jen správce.';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_guard_textbook_is_system() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tg_guard_textbook_is_system
BEFORE INSERT OR UPDATE OF is_system ON public.teacher_textbooks
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_textbook_is_system();

-- Writes on system textbooks: admin only (restrictive, so no existing permission widens)
CREATE POLICY system_guard_update ON public.teacher_textbooks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT is_system OR public.is_admin()) WITH CHECK (NOT is_system OR public.is_admin());
CREATE POLICY system_guard_delete ON public.teacher_textbooks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT is_system OR public.is_admin());

-- Read: all signed-in teachers/lecturers/admins, only non-deleted
CREATE POLICY system_read ON public.teacher_textbooks AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_system AND deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()
      AND ur.role IN ('teacher'::app_role, 'lektor'::app_role, 'admin'::app_role)));

-- Lessons of system textbooks
CREATE POLICY system_guard_insert ON public.teacher_textbook_lessons AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR NOT EXISTS (SELECT 1 FROM public.teacher_textbooks t WHERE t.id = textbook_id AND t.is_system));
CREATE POLICY system_guard_update ON public.teacher_textbook_lessons AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.is_admin() OR NOT EXISTS (SELECT 1 FROM public.teacher_textbooks t WHERE t.id = textbook_id AND t.is_system))
  WITH CHECK (public.is_admin() OR NOT EXISTS (SELECT 1 FROM public.teacher_textbooks t WHERE t.id = textbook_id AND t.is_system));
CREATE POLICY system_guard_delete ON public.teacher_textbook_lessons AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_admin() OR NOT EXISTS (SELECT 1 FROM public.teacher_textbooks t WHERE t.id = textbook_id AND t.is_system));
CREATE POLICY system_read ON public.teacher_textbook_lessons AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teacher_textbooks t WHERE t.id = textbook_id AND t.is_system AND t.deleted_at IS NULL)
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()
      AND ur.role IN ('teacher'::app_role, 'lektor'::app_role, 'admin'::app_role)));