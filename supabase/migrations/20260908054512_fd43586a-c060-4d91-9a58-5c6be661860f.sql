CREATE TABLE public.school_calendar_event_dismissals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.school_calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.school_calendar_event_dismissals TO authenticated;
GRANT ALL ON public.school_calendar_event_dismissals TO service_role;

ALTER TABLE public.school_calendar_event_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own dismissals"
ON public.school_calendar_event_dismissals FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users create own dismissals"
ON public.school_calendar_event_dismissals FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own dismissals"
ON public.school_calendar_event_dismissals FOR DELETE TO authenticated
USING (user_id = auth.uid());

ALTER TABLE public.school_calendar_events
  ADD COLUMN IF NOT EXISTS dismissed_for_all_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_for_all_by uuid;

CREATE OR REPLACE FUNCTION public.set_school_event_dismissed_for_all(_event_id uuid, _dismissed boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ev public.school_calendar_events;
BEGIN
  SELECT * INTO _ev FROM public.school_calendar_events WHERE id = _event_id;
  IF _ev.id IS NULL THEN
    RAISE EXCEPTION 'Událost nenalezena';
  END IF;
  IF NOT (_ev.created_by = auth.uid()
          OR public.is_school_admin_of(_ev.school_id)
          OR public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Nemáte oprávnění označit událost pro celou školu';
  END IF;

  UPDATE public.school_calendar_events
     SET dismissed_for_all_at = CASE WHEN _dismissed THEN now() ELSE NULL END,
         dismissed_for_all_by = CASE WHEN _dismissed THEN auth.uid() ELSE NULL END
   WHERE id = _event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_school_event_dismissed_for_all(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_school_event_dismissed_for_all(uuid, boolean) TO authenticated;