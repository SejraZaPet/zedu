ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS teams jsonb NOT NULL DEFAULT '{"teams":[]}'::jsonb;