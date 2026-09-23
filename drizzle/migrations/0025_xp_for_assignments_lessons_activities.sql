-- XP za odevzdání úkolu (funguje na skutečné tabulce assignment_attempts)
CREATE OR REPLACE FUNCTION public.trg_add_xp_assignment_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'submitted'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted')
     AND NEW.student_id IS NOT NULL THEN
    PERFORM public.add_xp(NEW.student_id, 20);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_xp_on_assignment_attempt ON public.assignment_attempts;
CREATE TRIGGER add_xp_on_assignment_attempt
  AFTER INSERT OR UPDATE OF status ON public.assignment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.trg_add_xp_assignment_attempt();

-- XP za dokončení lekce
CREATE OR REPLACE FUNCTION public.trg_add_xp_lesson_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    PERFORM public.add_xp(NEW.user_id, 15);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_xp_on_lesson_completion ON public.student_lesson_completions;
CREATE TRIGGER add_xp_on_lesson_completion
  AFTER INSERT ON public.student_lesson_completions
  FOR EACH ROW EXECUTE FUNCTION public.trg_add_xp_lesson_completion();

-- XP za úspěch v aktivitě v lekci / pracovním listu
CREATE OR REPLACE FUNCTION public.trg_add_xp_activity_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ratio NUMERIC;
  _xp INT;
  _prev NUMERIC := 0;
BEGIN
  IF NEW.user_id IS NULL OR COALESCE(NEW.max_score, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  _ratio := LEAST(1, GREATEST(0, COALESCE(NEW.score, 0)::numeric / NEW.max_score));

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.max_score, 0) > 0 THEN
    _prev := LEAST(1, GREATEST(0, COALESCE(OLD.score, 0)::numeric / OLD.max_score));
  END IF;

  -- uděl jen přírůstek, aby opakované ukládání nenafukovalo XP
  _xp := FLOOR(GREATEST(0, _ratio - _prev) * 10);

  IF _xp > 0 THEN
    PERFORM public.add_xp(NEW.user_id, _xp);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_xp_on_activity_result ON public.student_activity_results;
CREATE TRIGGER add_xp_on_activity_result
  AFTER INSERT OR UPDATE OF score, max_score ON public.student_activity_results
  FOR EACH ROW EXECUTE FUNCTION public.trg_add_xp_activity_result();