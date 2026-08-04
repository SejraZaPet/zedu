ALTER TABLE public.game_sessions
  ALTER COLUMN whiteboard_data
  SET DEFAULT '{"visible":false,"strokesBySlide":{}}'::jsonb;

UPDATE public.game_sessions
SET whiteboard_data = jsonb_build_object(
  'visible', COALESCE((whiteboard_data->>'visible')::boolean, false),
  'strokesBySlide', CASE
    WHEN jsonb_typeof(whiteboard_data->'strokes') = 'array'
         AND jsonb_array_length(whiteboard_data->'strokes') > 0
      THEN jsonb_build_object('0', whiteboard_data->'strokes')
    ELSE '{}'::jsonb
  END
)
WHERE whiteboard_data ? 'strokes'
  AND NOT (whiteboard_data ? 'strokesBySlide');