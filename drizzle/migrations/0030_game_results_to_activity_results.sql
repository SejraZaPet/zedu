ALTER TABLE public.student_activity_results
  ALTER COLUMN lesson_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source_game_session_id uuid REFERENCES public.game_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_lesson_id uuid;

CREATE INDEX IF NOT EXISTS idx_sar_source_game ON public.student_activity_results(source_game_session_id);

CREATE OR REPLACE FUNCTION public.sync_game_results_to_activity_results()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'finished' OR OLD.status = 'finished' THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.student_activity_results WHERE source_game_session_id = NEW.id;

  INSERT INTO public.student_activity_results
    (user_id, lesson_id, source_lesson_id, source_game_session_id,
     activity_index, activity_type, score, max_score, completed_at)
  SELECT r.user_id,
         CASE WHEN EXISTS (SELECT 1 FROM public.textbook_lessons tl WHERE tl.id = r.src_lesson) THEN r.src_lesson END,
         r.src_lesson,
         NEW.id,
         1000 + r.question_index,
         r.act_type,
         CASE WHEN r.is_correct THEN 1 ELSE 0 END,
         1,
         r.created_at
  FROM (
    SELECT DISTINCT ON (p.user_id, gr.question_index)
           p.user_id, gr.question_index, gr.is_correct, gr.created_at,
           COALESCE(
             NULLIF(NEW.activity_data -> gr.question_index -> 'activitySpec' ->> 'type', ''),
             NULLIF(NEW.activity_data -> gr.question_index ->> 'type', ''),
             'game'
           ) AS act_type,
           CASE WHEN COALESCE(NEW.activity_data -> gr.question_index ->> 'sourceLessonId', NEW.settings ->> 'sourceLessonId')
                     ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN COALESCE(NEW.activity_data -> gr.question_index ->> 'sourceLessonId', NEW.settings ->> 'sourceLessonId')::uuid
           END AS src_lesson
    FROM public.game_responses gr
    JOIN public.game_players p ON p.id = gr.player_id
    JOIN public.profiles pr ON pr.id = p.user_id
    WHERE gr.session_id = NEW.id AND p.user_id IS NOT NULL
    ORDER BY p.user_id, gr.question_index, gr.created_at DESC
  ) r;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_game_results_to_activity_results failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_game_results_to_activity_results ON public.game_sessions;
CREATE TRIGGER trg_game_results_to_activity_results
AFTER UPDATE OF status ON public.game_sessions
FOR EACH ROW EXECUTE FUNCTION public.sync_game_results_to_activity_results();