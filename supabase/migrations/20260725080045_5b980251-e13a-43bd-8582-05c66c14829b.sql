
CREATE TABLE public.textbook_trial_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  textbook_id uuid NOT NULL REFERENCES public.teacher_textbooks(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  UNIQUE (textbook_id, teacher_id)
);

CREATE INDEX idx_textbook_trial_activations_teacher ON public.textbook_trial_activations(teacher_id);
CREATE INDEX idx_textbook_trial_activations_textbook ON public.textbook_trial_activations(textbook_id);

GRANT SELECT, INSERT ON public.textbook_trial_activations TO authenticated;
GRANT ALL ON public.textbook_trial_activations TO service_role;

ALTER TABLE public.textbook_trial_activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can read their own trials"
  ON public.textbook_trial_activations FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can start their own trials"
  ON public.textbook_trial_activations FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND public.is_public_shared_textbook(textbook_id)
  );

-- Helper: has the current user an active trial for this textbook?
CREATE OR REPLACE FUNCTION public.has_active_textbook_trial(_textbook_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.textbook_trial_activations
    WHERE textbook_id = _textbook_id
      AND teacher_id = _user_id
      AND expires_at > now()
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_active_textbook_trial(uuid, uuid) TO authenticated;
