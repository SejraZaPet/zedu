
-- 1) Extend student_portfolio_items
ALTER TABLE public.student_portfolio_items
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS video_url text;

ALTER TABLE public.student_portfolio_items
  DROP CONSTRAINT IF EXISTS student_portfolio_items_source_type_check;
ALTER TABLE public.student_portfolio_items
  ADD CONSTRAINT student_portfolio_items_source_type_check
  CHECK (source_type IN ('manual','worksheet','assignment','portfolio_task'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_items_student_source
  ON public.student_portfolio_items(student_id, source_assignment_id)
  WHERE source_assignment_id IS NOT NULL;

-- 2) Extend assignments
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS is_portfolio_task boolean NOT NULL DEFAULT false;

-- 3) New table student_portfolio_files
CREATE TABLE IF NOT EXISTS public.student_portfolio_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_item_id uuid NOT NULL REFERENCES public.student_portfolio_items(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'other',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_portfolio_files TO authenticated;
GRANT ALL ON public.student_portfolio_files TO service_role;

ALTER TABLE public.student_portfolio_files ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_portfolio_files_item ON public.student_portfolio_files(portfolio_item_id, sort_order);

DROP POLICY IF EXISTS "Student manages own portfolio files" ON public.student_portfolio_files;
CREATE POLICY "Student manages own portfolio files" ON public.student_portfolio_files
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_portfolio_items pi
    WHERE pi.id = portfolio_item_id AND pi.student_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.student_portfolio_items pi
    WHERE pi.id = portfolio_item_id AND pi.student_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Teachers view student portfolio files" ON public.student_portfolio_files;
CREATE POLICY "Teachers view student portfolio files" ON public.student_portfolio_files
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_portfolio_items pi
    WHERE pi.id = portfolio_item_id
      AND public.is_teacher_of_student(pi.student_id, auth.uid())
  ));

DROP POLICY IF EXISTS "Parents view child portfolio files" ON public.student_portfolio_files;
CREATE POLICY "Parents view child portfolio files" ON public.student_portfolio_files
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_portfolio_items pi
    WHERE pi.id = portfolio_item_id
      AND public.is_parent_of_student(pi.student_id, auth.uid())
  ));

DROP POLICY IF EXISTS "Admins view all portfolio files" ON public.student_portfolio_files;
CREATE POLICY "Admins view all portfolio files" ON public.student_portfolio_files
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- 4) Auto-link trigger: assignment_attempt -> portfolio item
CREATE OR REPLACE FUNCTION public.sync_portfolio_from_attempt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _a public.assignments;
  _class RECORD;
  _subject text;
  _src_type text;
  _title text;
  _item_id uuid;
  _teacher_comment text;
  _teacher_id uuid;
BEGIN
  -- Only act on submitted/graded attempts that have some feedback (score or teacher comment)
  IF NEW.status <> 'submitted' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _a FROM public.assignments WHERE id = NEW.assignment_id;
  IF _a IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine source_type
  IF _a.is_portfolio_task THEN
    _src_type := 'portfolio_task';
  ELSIF _a.worksheet_id IS NOT NULL THEN
    _src_type := 'worksheet';
  ELSE
    -- Skip non-worksheet, non-portfolio-task assignments (e.g. pure quiz activity)
    RETURN NEW;
  END IF;

  -- Derive subject from class if possible
  BEGIN
    SELECT c.subject INTO _subject FROM public.classes c WHERE c.id = _a.class_id;
  EXCEPTION WHEN OTHERS THEN
    _subject := NULL;
  END;

  _title := COALESCE(NULLIF(_a.title, ''), 'Úkol');
  _teacher_id := _a.teacher_id;

  -- Upsert portfolio item
  INSERT INTO public.student_portfolio_items
    (student_id, title, subject, type, source_type, source_assignment_id, content_json)
  VALUES (
    NEW.student_id, _title, _subject,
    CASE WHEN _src_type = 'worksheet' THEN 'worksheet_result' ELSE 'project' END,
    _src_type, _a.id,
    jsonb_build_object(
      'score', NEW.score,
      'max_score', NEW.max_score,
      'attempt_id', NEW.id,
      'submitted_at', NEW.submitted_at
    )
  )
  ON CONFLICT (student_id, source_assignment_id) WHERE source_assignment_id IS NOT NULL
  DO UPDATE SET
    title = EXCLUDED.title,
    subject = COALESCE(EXCLUDED.subject, public.student_portfolio_items.subject),
    content_json = EXCLUDED.content_json,
    updated_at = now()
  RETURNING id INTO _item_id;

  IF _item_id IS NULL THEN
    SELECT id INTO _item_id FROM public.student_portfolio_items
      WHERE student_id = NEW.student_id AND source_assignment_id = _a.id
      LIMIT 1;
  END IF;

  IF _item_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Copy attachment references (idempotent)
  INSERT INTO public.student_portfolio_files (portfolio_item_id, file_name, file_url, file_type)
  SELECT _item_id, aa.file_name, aa.file_path,
    CASE
      WHEN aa.file_name ~* '\.(pdf)$' THEN 'pdf'
      WHEN aa.file_name ~* '\.(png|jpe?g|webp|gif|heic)$' THEN 'image'
      ELSE 'other'
    END
  FROM public.assignment_attachments aa
  WHERE aa.assignment_id = _a.id
    AND aa.student_id = NEW.student_id
    AND NOT EXISTS (
      SELECT 1 FROM public.student_portfolio_files f
      WHERE f.portfolio_item_id = _item_id AND f.file_url = aa.file_path
    );

  -- Copy teacher feedback if present (attempt-level 'teacher_comment' in answers/progress)
  _teacher_comment := COALESCE(
    NEW.answers->>'teacher_comment',
    NEW.progress->>'teacher_comment'
  );
  IF _teacher_comment IS NOT NULL AND length(trim(_teacher_comment)) > 0 AND _teacher_id IS NOT NULL THEN
    INSERT INTO public.student_portfolio_comments (item_id, author_id, body)
    SELECT _item_id, _teacher_id, _teacher_comment
    WHERE NOT EXISTS (
      SELECT 1 FROM public.student_portfolio_comments c
      WHERE c.item_id = _item_id AND c.author_id = _teacher_id AND c.body = _teacher_comment
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_portfolio_from_attempt failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_portfolio_from_attempt ON public.assignment_attempts;
CREATE TRIGGER trg_sync_portfolio_from_attempt
AFTER INSERT OR UPDATE OF status, score, answers ON public.assignment_attempts
FOR EACH ROW EXECUTE FUNCTION public.sync_portfolio_from_attempt();
