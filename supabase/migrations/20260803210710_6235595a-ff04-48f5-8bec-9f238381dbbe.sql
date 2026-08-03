DROP TRIGGER IF EXISTS trg_mark_ai_modified_worksheets ON public.worksheets;
CREATE TRIGGER trg_mark_ai_modified_worksheets
BEFORE UPDATE ON public.worksheets
FOR EACH ROW EXECUTE FUNCTION public.mark_ai_content_modified();

DROP TRIGGER IF EXISTS trg_mark_ai_modified_lesson_plans ON public.lesson_plans;
CREATE TRIGGER trg_mark_ai_modified_lesson_plans
BEFORE UPDATE ON public.lesson_plans
FOR EACH ROW EXECUTE FUNCTION public.mark_ai_content_modified();

DROP TRIGGER IF EXISTS trg_mark_ai_modified_curriculum_topics ON public.curriculum_topics;
CREATE TRIGGER trg_mark_ai_modified_curriculum_topics
BEFORE UPDATE ON public.curriculum_topics
FOR EACH ROW EXECUTE FUNCTION public.mark_ai_content_modified();

DROP TRIGGER IF EXISTS trg_mark_ai_modified_portfolio_comments ON public.student_portfolio_comments;
CREATE TRIGGER trg_mark_ai_modified_portfolio_comments
BEFORE UPDATE ON public.student_portfolio_comments
FOR EACH ROW EXECUTE FUNCTION public.mark_ai_content_modified();