-- 1) Vazba zadání na předmět (Výuka = předmět + třída/skupina)
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_subject_id ON public.assignments(subject_id);

-- 2) Tabulka spoluučitelů Výuky
CREATE TABLE IF NOT EXISTS public.teaching_unit_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.subject_groups(id) ON DELETE CASCADE,
  invited_teacher_id uuid NOT NULL,
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teaching_unit_target_exactly_one CHECK (
    (class_id IS NOT NULL AND group_id IS NULL) OR (class_id IS NULL AND group_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tuc_unit_teacher
  ON public.teaching_unit_collaborators (
    subject_id,
    COALESCE(class_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(group_id, '00000000-0000-0000-0000-000000000000'::uuid),
    invited_teacher_id
  );

CREATE INDEX IF NOT EXISTS idx_tuc_invited_teacher ON public.teaching_unit_collaborators(invited_teacher_id);
CREATE INDEX IF NOT EXISTS idx_tuc_invited_by ON public.teaching_unit_collaborators(invited_by);

GRANT SELECT, INSERT, DELETE ON public.teaching_unit_collaborators TO authenticated;
GRANT ALL ON public.teaching_unit_collaborators TO service_role;

ALTER TABLE public.teaching_unit_collaborators ENABLE ROW LEVEL SECURITY;

-- 3) Bezpečnostní funkce
CREATE OR REPLACE FUNCTION public.is_teaching_unit_collaborator(
  _subject_id uuid, _class_id uuid, _group_id uuid, _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _subject_id IS NOT NULL AND _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.teaching_unit_collaborators c
    WHERE c.invited_teacher_id = _user_id
      AND c.subject_id = _subject_id
      AND (
        (_class_id IS NOT NULL AND c.class_id = _class_id)
        OR (_group_id IS NOT NULL AND c.group_id = _group_id)
      )
  )
$$;

-- Varianta pro obsah bez vazby na třídu (plány hodin, pracovní listy):
-- spoluučitel vidí obsah autora, pokud ho autor přizval k Výuce s tímto předmětem.
CREATE OR REPLACE FUNCTION public.is_subject_collaborator_of(
  _owner_id uuid, _subject_id uuid, _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _owner_id IS NOT NULL AND _subject_id IS NOT NULL AND _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.teaching_unit_collaborators c
    WHERE c.invited_teacher_id = _user_id
      AND c.invited_by = _owner_id
      AND c.subject_id = _subject_id
  )
$$;

-- 4) Validace: stejná škola + pozvatel je sám sebou
CREATE OR REPLACE FUNCTION public.tg_validate_teaching_unit_collaborator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inviter_school uuid;
  _invitee_school uuid;
BEGIN
  IF NEW.invited_teacher_id = NEW.invited_by THEN
    RAISE EXCEPTION 'Nelze pozvat sám sebe jako spoluučitele.';
  END IF;

  IF auth.uid() IS NOT NULL AND NEW.invited_by <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Pozvání musí vytvořit přihlášený učitel sám za sebe.';
  END IF;

  _inviter_school := public.get_user_school_id(NEW.invited_by);
  _invitee_school := public.get_user_school_id(NEW.invited_teacher_id);

  IF _inviter_school IS NULL OR _invitee_school IS NULL OR _inviter_school <> _invitee_school THEN
    RAISE EXCEPTION 'Spoluučitele lze pozvat pouze v rámci stejné školy.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_teaching_unit_collaborator ON public.teaching_unit_collaborators;
CREATE TRIGGER trg_validate_teaching_unit_collaborator
  BEFORE INSERT ON public.teaching_unit_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_teaching_unit_collaborator();

-- 5) RLS pro samotnou tabulku
DROP POLICY IF EXISTS "Participants can read collaborators" ON public.teaching_unit_collaborators;
CREATE POLICY "Participants can read collaborators"
  ON public.teaching_unit_collaborators FOR SELECT TO authenticated
  USING (public.is_admin() OR invited_by = auth.uid() OR invited_teacher_id = auth.uid());

DROP POLICY IF EXISTS "Teachers can invite collaborators" ON public.teaching_unit_collaborators;
CREATE POLICY "Teachers can invite collaborators"
  ON public.teaching_unit_collaborators FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_teacher() AND (invited_by = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "Inviter or invitee can remove collaborator" ON public.teaching_unit_collaborators;
CREATE POLICY "Inviter or invitee can remove collaborator"
  ON public.teaching_unit_collaborators FOR DELETE TO authenticated
  USING (public.is_admin() OR invited_by = auth.uid() OR invited_teacher_id = auth.uid());

-- 6) Rozšíření RLS na obsah — přidané politiky, stávající zůstávají nedotčené
DROP POLICY IF EXISTS "Collaborators can read teaching unit assignments" ON public.assignments;
CREATE POLICY "Collaborators can read teaching unit assignments"
  ON public.assignments FOR SELECT TO authenticated
  USING (public.is_teaching_unit_collaborator(subject_id, class_id, group_id, auth.uid()));

DROP POLICY IF EXISTS "Collaborators can update teaching unit assignments" ON public.assignments;
CREATE POLICY "Collaborators can update teaching unit assignments"
  ON public.assignments FOR UPDATE TO authenticated
  USING (public.is_teaching_unit_collaborator(subject_id, class_id, group_id, auth.uid()))
  WITH CHECK (public.is_teaching_unit_collaborator(subject_id, class_id, group_id, auth.uid()));

DROP POLICY IF EXISTS "Collaborators can read attempts of unit assignments" ON public.assignment_attempts;
CREATE POLICY "Collaborators can read attempts of unit assignments"
  ON public.assignment_attempts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_attempts.assignment_id
      AND public.is_teaching_unit_collaborator(a.subject_id, a.class_id, a.group_id, auth.uid())
  ));

DROP POLICY IF EXISTS "Collaborators can grade attempts of unit assignments" ON public.assignment_attempts;
CREATE POLICY "Collaborators can grade attempts of unit assignments"
  ON public.assignment_attempts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_attempts.assignment_id
      AND public.is_teaching_unit_collaborator(a.subject_id, a.class_id, a.group_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_attempts.assignment_id
      AND public.is_teaching_unit_collaborator(a.subject_id, a.class_id, a.group_id, auth.uid())
  ));

DROP POLICY IF EXISTS "Collaborators can read shared subject lesson_plans" ON public.lesson_plans;
CREATE POLICY "Collaborators can read shared subject lesson_plans"
  ON public.lesson_plans FOR SELECT TO authenticated
  USING (public.is_subject_collaborator_of(teacher_id, subject_id, auth.uid()));

DROP POLICY IF EXISTS "Collaborators can update shared subject lesson_plans" ON public.lesson_plans;
CREATE POLICY "Collaborators can update shared subject lesson_plans"
  ON public.lesson_plans FOR UPDATE TO authenticated
  USING (public.is_subject_collaborator_of(teacher_id, subject_id, auth.uid()))
  WITH CHECK (public.is_subject_collaborator_of(teacher_id, subject_id, auth.uid()));

DROP POLICY IF EXISTS "Collaborators can read shared subject worksheets" ON public.worksheets;
CREATE POLICY "Collaborators can read shared subject worksheets"
  ON public.worksheets FOR SELECT TO authenticated
  USING (public.is_subject_collaborator_of(teacher_id, subject_id, auth.uid()));

DROP POLICY IF EXISTS "Collaborators can update shared subject worksheets" ON public.worksheets;
CREATE POLICY "Collaborators can update shared subject worksheets"
  ON public.worksheets FOR UPDATE TO authenticated
  USING (public.is_subject_collaborator_of(teacher_id, subject_id, auth.uid()))
  WITH CHECK (public.is_subject_collaborator_of(teacher_id, subject_id, auth.uid()));