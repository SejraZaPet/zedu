CREATE TABLE public.zedstart_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category text CHECK (category IN ('vizualni','verbalni','pohybova','tymova','jina')),
  prompt_text text NOT NULL,
  suggested_duration_minutes integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zedstart_prompts TO authenticated;
GRANT ALL ON public.zedstart_prompts TO service_role;

ALTER TABLE public.zedstart_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own zedstart prompts"
ON public.zedstart_prompts FOR ALL TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE INDEX idx_zedstart_prompts_teacher ON public.zedstart_prompts(teacher_id);