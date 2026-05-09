
-- Tabulka student_xp
CREATE TABLE public.student_xp (
  student_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  streak_days INT NOT NULL DEFAULT 0,
  last_activity_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.student_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own XP"
  ON public.student_xp FOR SELECT
  USING (auth.uid() = student_id OR public.is_admin_or_teacher());

CREATE POLICY "Students insert own XP"
  ON public.student_xp FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students update own XP"
  ON public.student_xp FOR UPDATE
  USING (auth.uid() = student_id OR public.is_admin());

-- Tabulka student_badges
CREATE TABLE public.student_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_slug TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, badge_slug)
);

CREATE INDEX idx_student_badges_student ON public.student_badges(student_id);

ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own badges"
  ON public.student_badges FOR SELECT
  USING (auth.uid() = student_id OR public.is_admin_or_teacher());

CREATE POLICY "Admin manage badges"
  ON public.student_badges FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tabulka student_avatars
CREATE TABLE public.student_avatars (
  student_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_slug TEXT NOT NULL DEFAULT 'bear',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.student_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own avatar"
  ON public.student_avatars FOR SELECT
  USING (auth.uid() = student_id OR public.is_admin_or_teacher());

CREATE POLICY "Students upsert own avatar"
  ON public.student_avatars FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students update own avatar"
  ON public.student_avatars FOR UPDATE
  USING (auth.uid() = student_id);

-- Funkce add_xp
CREATE OR REPLACE FUNCTION public.add_xp(_student UUID, _amount INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.student_xp;
  _new_total INT;
  _new_level INT;
  _new_streak INT;
  _today DATE := (now() AT TIME ZONE 'Europe/Prague')::date;
  _milestone INT;
  _badges TEXT[] := ARRAY['xp_100','xp_500','xp_1000','xp_5000'];
  _thresholds INT[] := ARRAY[100,500,1000,5000];
  _i INT;
BEGIN
  IF _student IS NULL OR _amount IS NULL OR _amount <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.student_xp (student_id, total_xp, level, streak_days, last_activity_date)
  VALUES (_student, 0, 1, 0, NULL)
  ON CONFLICT (student_id) DO NOTHING;

  SELECT * INTO _row FROM public.student_xp WHERE student_id = _student FOR UPDATE;

  _new_total := _row.total_xp + _amount;
  _new_level := floor(sqrt(_new_total::numeric / 50)) + 1;

  -- Streak logic
  IF _row.last_activity_date IS NULL THEN
    _new_streak := 1;
  ELSIF _row.last_activity_date = _today THEN
    _new_streak := GREATEST(_row.streak_days, 1);
  ELSIF _row.last_activity_date = _today - 1 THEN
    _new_streak := _row.streak_days + 1;
  ELSE
    _new_streak := 1;
  END IF;

  UPDATE public.student_xp
  SET total_xp = _new_total,
      level = _new_level,
      streak_days = _new_streak,
      last_activity_date = _today,
      updated_at = now()
  WHERE student_id = _student;

  -- XP milestone badges
  FOR _i IN 1..array_length(_thresholds, 1) LOOP
    IF _new_total >= _thresholds[_i] THEN
      INSERT INTO public.student_badges (student_id, badge_slug)
      VALUES (_student, _badges[_i])
      ON CONFLICT (student_id, badge_slug) DO NOTHING;
    END IF;
  END LOOP;

  -- Level milestone badges
  IF _new_level >= 5 THEN
    INSERT INTO public.student_badges (student_id, badge_slug)
    VALUES (_student, 'level_5') ON CONFLICT DO NOTHING;
  END IF;
  IF _new_level >= 10 THEN
    INSERT INTO public.student_badges (student_id, badge_slug)
    VALUES (_student, 'level_10') ON CONFLICT DO NOTHING;
  END IF;

  -- Streak badges
  IF _new_streak >= 7 THEN
    INSERT INTO public.student_badges (student_id, badge_slug)
    VALUES (_student, 'streak_7') ON CONFLICT DO NOTHING;
  END IF;
  IF _new_streak >= 30 THEN
    INSERT INTO public.student_badges (student_id, badge_slug)
    VALUES (_student, 'streak_30') ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Trigger: assignment_submissions
CREATE OR REPLACE FUNCTION public.trg_add_xp_assignment_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    PERFORM public.add_xp(NEW.student_id, 20);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='assignment_submissions') THEN
    DROP TRIGGER IF EXISTS add_xp_on_assignment_submission ON public.assignment_submissions;
    CREATE TRIGGER add_xp_on_assignment_submission
      AFTER INSERT ON public.assignment_submissions
      FOR EACH ROW EXECUTE FUNCTION public.trg_add_xp_assignment_submission();
  END IF;
END $$;

-- Trigger: student_practice_sessions
CREATE OR REPLACE FUNCTION public.trg_add_xp_practice_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    PERFORM public.add_xp(NEW.student_id, 10);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='student_practice_sessions') THEN
    DROP TRIGGER IF EXISTS add_xp_on_practice_session ON public.student_practice_sessions;
    CREATE TRIGGER add_xp_on_practice_session
      AFTER INSERT ON public.student_practice_sessions
      FOR EACH ROW EXECUTE FUNCTION public.trg_add_xp_practice_session();
  END IF;
END $$;
