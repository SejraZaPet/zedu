
CREATE OR REPLACE FUNCTION public.get_public_content_usage_counts(
  _textbook_ids uuid[],
  _worksheet_ids uuid[],
  _lesson_plan_ids uuid[]
)
RETURNS TABLE(kind text, source_id uuid, usage_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'textbook'::text, copied_from_textbook_id, COUNT(*)::bigint
  FROM public.teacher_textbooks
  WHERE copied_from_textbook_id = ANY(COALESCE(_textbook_ids, ARRAY[]::uuid[]))
  GROUP BY copied_from_textbook_id
  UNION ALL
  SELECT 'worksheet'::text, copied_from_worksheet_id, COUNT(*)::bigint
  FROM public.worksheets
  WHERE copied_from_worksheet_id = ANY(COALESCE(_worksheet_ids, ARRAY[]::uuid[]))
  GROUP BY copied_from_worksheet_id
  UNION ALL
  SELECT 'lesson_plan'::text, copied_from_lesson_plan_id, COUNT(*)::bigint
  FROM public.lesson_plans
  WHERE copied_from_lesson_plan_id = ANY(COALESCE(_lesson_plan_ids, ARRAY[]::uuid[]))
  GROUP BY copied_from_lesson_plan_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_content_usage_counts(uuid[], uuid[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_content_usage_counts(uuid[], uuid[], uuid[]) TO authenticated;
