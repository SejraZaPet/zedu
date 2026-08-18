-- 1) Naplánované zveřejnění úkolů
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_assignments_scheduled_publish
  ON public.assignments (scheduled_publish_at)
  WHERE status = 'scheduled';

CREATE OR REPLACE FUNCTION public.publish_due_assignments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.assignments
     SET status = 'published',
         scheduled_publish_at = NULL
   WHERE status = 'scheduled'
     AND scheduled_publish_at IS NOT NULL
     AND scheduled_publish_at <= now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_due_assignments() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_due_assignments() TO service_role;

-- 2) Více ŠVP dokumentů na jeden předmět
ALTER TABLE public.teacher_curriculum_plans
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';

ALTER TABLE public.teacher_curriculum_plans
  DROP CONSTRAINT IF EXISTS teacher_curriculum_plans_teacher_id_subject_key;

CREATE UNIQUE INDEX IF NOT EXISTS teacher_curriculum_plans_teacher_subject_title_key
  ON public.teacher_curriculum_plans (teacher_id, subject, title);