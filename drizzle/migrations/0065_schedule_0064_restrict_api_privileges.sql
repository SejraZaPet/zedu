REVOKE ALL PRIVILEGES ON TABLE public.schedule_exceptions, public.schedule_exception_notes, public.schedule_plan_occurrence_links FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.schedule_exceptions, public.schedule_exception_notes, public.schedule_plan_occurrence_links FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.schedule_exceptions, public.schedule_exception_notes, public.schedule_plan_occurrence_links TO authenticated;

REVOKE EXECUTE ON FUNCTION public.schedule_demo_access(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.schedule_source_occurrence(text, text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_schedule_exception(text, text, date, text, date, time without time zone, time without time zone, text, text, boolean, integer, uuid, uuid[], text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.read_schedule_exceptions(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_demo_access(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_source_occurrence(text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_schedule_exception(text, text, date, text, date, time without time zone, time without time zone, text, text, boolean, integer, uuid, uuid[], text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.read_schedule_exceptions(date, date) TO authenticated;