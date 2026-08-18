CREATE OR REPLACE FUNCTION public.subject_dependency_counts(_subject_ids uuid[])
RETURNS TABLE (subject_id uuid, group_count bigint, class_subject_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id,
         (SELECT count(*) FROM public.subject_groups g WHERE g.subject_id = s.id),
         (SELECT count(*) FROM public.class_subjects cs WHERE cs.subject_id = s.id)
  FROM public.subjects s
  WHERE s.id = ANY(_subject_ids)
$$;

REVOKE ALL ON FUNCTION public.subject_dependency_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subject_dependency_counts(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.subject_dependency_counts(uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.tg_block_subject_delete_with_deps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g_count int;
  cs_count int;
BEGIN
  SELECT count(*) INTO g_count FROM public.subject_groups WHERE subject_id = OLD.id;
  SELECT count(*) INTO cs_count FROM public.class_subjects WHERE subject_id = OLD.id;
  IF g_count > 0 OR cs_count > 0 THEN
    RAISE EXCEPTION 'Předmět má navázané skupiny nebo třídy a nelze ho smazat. Archivujte ho.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS block_subject_delete_with_deps ON public.subjects;
CREATE TRIGGER block_subject_delete_with_deps
BEFORE DELETE ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.tg_block_subject_delete_with_deps();