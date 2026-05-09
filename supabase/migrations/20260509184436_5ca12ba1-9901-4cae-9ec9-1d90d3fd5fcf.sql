ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS whiteboard_data jsonb NOT NULL DEFAULT '{"strokes":[],"visible":false}'::jsonb;