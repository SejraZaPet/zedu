ALTER TABLE public.teacher_game_templates
  ADD COLUMN IF NOT EXISTS default_team_count integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS team_scoring text NOT NULL DEFAULT 'avg';
ALTER TABLE public.teacher_game_templates
  ADD CONSTRAINT teacher_game_templates_team_count_chk CHECK (default_team_count BETWEEN 2 AND 6),
  ADD CONSTRAINT teacher_game_templates_team_scoring_chk CHECK (team_scoring IN ('avg','sum'));