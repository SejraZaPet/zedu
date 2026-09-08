CREATE OR REPLACE FUNCTION public.submit_portfolio_assignment(_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _attempt public.assignment_attempts;
  _assignment public.assignments;
  _subject text;
  _item_id uuid;
  _submitted_at timestamptz := now();
  _file_count integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Pro odevzdání se musíte přihlásit.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _attempt
  FROM public.assignment_attempts
  WHERE id = _attempt_id
  FOR UPDATE;

  IF NOT FOUND OR _attempt.student_id <> _uid THEN
    RAISE EXCEPTION 'Pokus nebyl nalezen nebo vám nepatří.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _assignment
  FROM public.assignments
  WHERE id = _attempt.assignment_id;

  IF NOT FOUND OR NOT COALESCE(_assignment.is_portfolio_task, false) THEN
    RAISE EXCEPTION 'Tento úkol není portfoliový.' USING ERRCODE = '22023';
  END IF;

  IF _assignment.status <> 'published' THEN
    RAISE EXCEPTION 'Tento úkol není zveřejněný.' USING ERRCODE = '22023';
  END IF;

  IF _assignment.deadline IS NOT NULL AND _assignment.deadline < _submitted_at THEN
    RAISE EXCEPTION 'Termín odevzdání už vypršel.' USING ERRCODE = '22023';
  END IF;

  IF _attempt.status = 'submitted' THEN
    SELECT id INTO _item_id
    FROM public.student_portfolio_items
    WHERE student_id = _uid
      AND source_assignment_id = _assignment.id
    LIMIT 1;

    RETURN jsonb_build_object(
      'attempt_id', _attempt.id,
      'status', _attempt.status,
      'submitted_at', _attempt.submitted_at,
      'portfolio_item_id', _item_id,
      'already_submitted', true
    );
  END IF;

  IF _attempt.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Tento pokus už nelze odevzdat.' USING ERRCODE = '22023';
  END IF;

  SELECT s.name INTO _subject
  FROM public.subjects s
  WHERE s.id = _assignment.subject_id;

  INSERT INTO public.student_portfolio_items
    (student_id, title, description, subject, type, source_type, source_assignment_id, content_json)
  VALUES (
    _uid,
    COALESCE(NULLIF(_assignment.title, ''), 'Úkol'),
    NULLIF(_assignment.description, ''),
    _subject,
    'project',
    'portfolio_task',
    _assignment.id,
    jsonb_build_object(
      'attempt_id', _attempt.id,
      'submitted_at', _submitted_at
    )
  )
  ON CONFLICT (student_id, source_assignment_id) WHERE source_assignment_id IS NOT NULL
  DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    subject = COALESCE(EXCLUDED.subject, public.student_portfolio_items.subject),
    source_type = 'portfolio_task',
    content_json = EXCLUDED.content_json,
    updated_at = now()
  RETURNING id INTO _item_id;

  INSERT INTO public.student_portfolio_files
    (portfolio_item_id, file_name, file_url, file_type, sort_order)
  SELECT
    _item_id,
    aa.file_name,
    aa.file_path,
    CASE
      WHEN aa.file_name ~* '\.(pdf)$' THEN 'pdf'
      WHEN aa.file_name ~* '\.(png|jpe?g|webp|gif|heic)$' THEN 'image'
      ELSE 'other'
    END,
    row_number() OVER (ORDER BY aa.uploaded_at, aa.id)::integer - 1
  FROM public.assignment_attachments aa
  WHERE aa.assignment_id = _assignment.id
    AND aa.student_id = _uid
    AND NOT EXISTS (
      SELECT 1
      FROM public.student_portfolio_files pf
      WHERE pf.portfolio_item_id = _item_id
        AND pf.file_url = aa.file_path
    );

  GET DIAGNOSTICS _file_count = ROW_COUNT;

  UPDATE public.assignment_attempts
  SET status = 'submitted',
      submitted_at = _submitted_at,
      last_saved_at = _submitted_at
  WHERE id = _attempt.id;

  RETURN jsonb_build_object(
    'attempt_id', _attempt.id,
    'status', 'submitted',
    'submitted_at', _submitted_at,
    'portfolio_item_id', _item_id,
    'portfolio_files_added', _file_count,
    'already_submitted', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_portfolio_assignment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_portfolio_assignment(uuid) TO authenticated;