ALTER TABLE public.worksheets
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_modified_at timestamptz;

ALTER TABLE public.lesson_plans
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_modified_at timestamptz;

ALTER TABLE public.curriculum_topics
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_modified_at timestamptz;

ALTER TABLE public.student_practice_sessions
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_modified_at timestamptz;

ALTER TABLE public.student_portfolio_comments
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_modified_at timestamptz;

-- Mark AI content as human-modified when its substantive content changes.
CREATE OR REPLACE FUNCTION public.mark_ai_content_modified()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  changed boolean := false;
BEGIN
  IF NEW.ai_generated IS NOT TRUE OR NEW.ai_modified_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'worksheets' THEN
    changed := (NEW.spec::text IS DISTINCT FROM OLD.spec::text)
      OR (NEW.title IS DISTINCT FROM OLD.title);
  ELSIF TG_TABLE_NAME = 'lesson_plans' THEN
    changed := (NEW.slides::text IS DISTINCT FROM OLD.slides::text)
      OR (NEW.title IS DISTINCT FROM OLD.title);
  ELSIF TG_TABLE_NAME = 'curriculum_topics' THEN
    changed := (NEW.title IS DISTINCT FROM OLD.title);
  ELSIF TG_TABLE_NAME = 'student_portfolio_comments' THEN
    changed := (NEW.body IS DISTINCT FROM OLD.body);
  END IF;

  IF changed THEN
    NEW.ai_modified_at := now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_ai_content_modified() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_ai_modified_worksheets ON public.worksheets;
CREATE TRIGGER trg_ai_modified_worksheets
  BEFORE UPDATE ON public.worksheets
  FOR EACH ROW EXECUTE FUNCTION public.mark_ai_content_modified();

DROP TRIGGER IF EXISTS trg_ai_modified_lesson_plans ON public.lesson_plans;
CREATE TRIGGER trg_ai_modified_lesson_plans
  BEFORE UPDATE ON public.lesson_plans
  FOR EACH ROW EXECUTE FUNCTION public.mark_ai_content_modified();

DROP TRIGGER IF EXISTS trg_ai_modified_curriculum_topics ON public.curriculum_topics;
CREATE TRIGGER trg_ai_modified_curriculum_topics
  BEFORE UPDATE ON public.curriculum_topics
  FOR EACH ROW EXECUTE FUNCTION public.mark_ai_content_modified();

DROP TRIGGER IF EXISTS trg_ai_modified_portfolio_comments ON public.student_portfolio_comments;
CREATE TRIGGER trg_ai_modified_portfolio_comments
  BEFORE UPDATE ON public.student_portfolio_comments
  FOR EACH ROW EXECUTE FUNCTION public.mark_ai_content_modified();