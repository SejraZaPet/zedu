ALTER TABLE public.game_sessions
  ALTER COLUMN settings SET DEFAULT '{"allowStudentDrawSync": false}'::jsonb;

UPDATE public.game_sessions
SET settings = COALESCE(settings, '{}'::jsonb) || '{"allowStudentDrawSync": false}'::jsonb
WHERE NOT (COALESCE(settings, '{}'::jsonb) ? 'allowStudentDrawSync');