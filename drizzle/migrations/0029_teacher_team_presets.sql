CREATE TABLE public.teacher_team_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL DEFAULT auth.uid(),
  source_kind text NOT NULL CHECK (source_kind IN ('class','group')),
  source_id uuid NOT NULL,
  teams jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, source_kind, source_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_team_presets TO authenticated;
GRANT ALL ON public.teacher_team_presets TO service_role;
ALTER TABLE public.teacher_team_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage own team presets" ON public.teacher_team_presets
  FOR ALL TO authenticated USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());