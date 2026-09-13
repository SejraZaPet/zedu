CREATE TABLE public.user_color_palettes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  colors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_color_palettes TO authenticated;
GRANT ALL ON public.user_color_palettes TO service_role;

ALTER TABLE public.user_color_palettes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own palettes" ON public.user_color_palettes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own palettes" ON public.user_color_palettes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own palettes" ON public.user_color_palettes
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own palettes" ON public.user_color_palettes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_user_color_palettes_user ON public.user_color_palettes (user_id, created_at DESC);