-- NÁVRH (neaplikováno). Varianta B: poslední návštěva předmětu synchronizovaná mezi zařízeními.
CREATE TABLE public.student_subject_visits (
  student_id uuid NOT NULL,
  target text NOT NULL,                 -- cesta předmětu /student/predmet/<předmět>/<trida|skupina>/<id>
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, target)
);
GRANT SELECT, INSERT, UPDATE ON public.student_subject_visits TO authenticated;
GRANT ALL ON public.student_subject_visits TO service_role;
ALTER TABLE public.student_subject_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY ssv_own ON public.student_subject_visits FOR ALL TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY demo_iso ON public.student_subject_visits AS RESTRICTIVE FOR ALL TO authenticated
  USING ((NOT public.is_demo_user(auth.uid())) OR public.demo_can_see_user(student_id))
  WITH CHECK ((NOT public.is_demo_user(auth.uid())) OR public.demo_can_see_user(student_id));
-- Po schválení zvlášť: doplnit tabulku do demo_purge_pair.
