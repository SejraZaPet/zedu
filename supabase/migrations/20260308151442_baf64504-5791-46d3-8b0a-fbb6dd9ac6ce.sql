
-- Student activity results
CREATE TABLE public.student_activity_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.textbook_lessons(id) ON DELETE CASCADE,
  activity_index integer NOT NULL DEFAULT 0,
  activity_type text NOT NULL DEFAULT '',
  score integer NOT NULL DEFAULT 0,
  max_score integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now()
);

-- Student lesson completions
CREATE TABLE public.student_lesson_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.textbook_lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- RLS
ALTER TABLE public.student_activity_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_lesson_completions ENABLE ROW LEVEL SECURITY;

-- Admin can read all
CREATE POLICY "Admin can read student_activity_results" ON public.student_activity_results FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admin can read student_lesson_completions" ON public.student_lesson_completions FOR SELECT TO authenticated USING (public.is_admin());

-- Students can insert their own
CREATE POLICY "Users can insert own activity results" ON public.student_activity_results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert own lesson completions" ON public.student_lesson_completions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Students can read their own
CREATE POLICY "Users can read own activity results" ON public.student_activity_results FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can read own lesson completions" ON public.student_lesson_completions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for activity tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_activity_results;
