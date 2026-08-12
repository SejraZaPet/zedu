CREATE TABLE public.game_backgrounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'universal' CHECK (category IN ('universal','subject','season','field')),
  subject_key text,
  season_key text CHECK (season_key IS NULL OR season_key IN ('jaro','leto','podzim','zima')),
  field_key text,
  image_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.game_backgrounds TO authenticated;
GRANT SELECT ON public.game_backgrounds TO anon;
GRANT ALL ON public.game_backgrounds TO service_role;

ALTER TABLE public.game_backgrounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active game backgrounds"
ON public.game_backgrounds FOR SELECT
TO anon, authenticated
USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins manage game backgrounds"
ON public.game_backgrounds FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE INDEX idx_game_backgrounds_category ON public.game_backgrounds (category, is_active);