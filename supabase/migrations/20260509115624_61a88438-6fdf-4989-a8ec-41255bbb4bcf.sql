-- Add leaderboard settings to classes
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS leaderboard_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS leaderboard_anonymous boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS leaderboard_reset_period text NOT NULL DEFAULT 'never',
  ADD COLUMN IF NOT EXISTS leaderboard_reset_at timestamptz;

-- Baseline snapshots for "since reset" XP calculation
CREATE TABLE IF NOT EXISTS public.class_leaderboard_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  baseline_xp integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id)
);

ALTER TABLE public.class_leaderboard_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Class members read baselines"
ON public.class_leaderboard_baselines FOR SELECT TO authenticated
USING (
  is_admin()
  OR is_class_teacher(class_id, auth.uid())
  OR EXISTS (SELECT 1 FROM class_members cm WHERE cm.class_id = class_leaderboard_baselines.class_id AND cm.user_id = auth.uid())
);

CREATE POLICY "Class teachers manage baselines"
ON public.class_leaderboard_baselines FOR ALL TO authenticated
USING (is_class_teacher(class_id, auth.uid()) OR is_admin())
WITH CHECK (is_class_teacher(class_id, auth.uid()) OR is_admin());

-- Reset RPC: snapshot current XP as baseline for all class members and bump reset_at
CREATE OR REPLACE FUNCTION public.reset_class_leaderboard(_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_class_teacher(_class_id, auth.uid()) OR is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.class_leaderboard_baselines (class_id, student_id, baseline_xp)
  SELECT _class_id, cm.user_id, COALESCE(sx.total_xp, 0)
  FROM public.class_members cm
  LEFT JOIN public.student_xp sx ON sx.student_id = cm.user_id
  WHERE cm.class_id = _class_id
  ON CONFLICT (class_id, student_id)
  DO UPDATE SET baseline_xp = EXCLUDED.baseline_xp, created_at = now();

  UPDATE public.classes SET leaderboard_reset_at = now() WHERE id = _class_id;
END;
$$;