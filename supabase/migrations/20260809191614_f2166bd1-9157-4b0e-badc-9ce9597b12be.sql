ALTER TABLE public.staff_calendar_events
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid,
  ADD COLUMN IF NOT EXISTS reminder_minutes integer[];

ALTER TABLE public.staff_tasks
  ADD COLUMN IF NOT EXISTS color text;

CREATE INDEX IF NOT EXISTS staff_calendar_events_recurrence_group_idx
  ON public.staff_calendar_events (recurrence_group_id);

CREATE TABLE IF NOT EXISTS public.staff_event_reminder_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.staff_calendar_events(id) ON DELETE CASCADE,
  minutes_before integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, minutes_before)
);

GRANT ALL ON public.staff_event_reminder_log TO service_role;

ALTER TABLE public.staff_event_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reminder log"
ON public.staff_event_reminder_log
FOR SELECT
TO authenticated
USING (public.is_admin());