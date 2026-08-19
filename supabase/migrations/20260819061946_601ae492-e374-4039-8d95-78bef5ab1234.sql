CREATE TABLE public.school_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  color text,
  location text,
  recurrence_rule text,
  recurrence_group_id uuid,
  reminder_minutes integer[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_school_calendar_events_school ON public.school_calendar_events(school_id, start_time);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_calendar_events TO authenticated;
GRANT ALL ON public.school_calendar_events TO service_role;
ALTER TABLE public.school_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view school events"
ON public.school_calendar_events FOR SELECT TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()) OR public.is_admin());

CREATE POLICY "School members can create school events"
ON public.school_calendar_events FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND school_id IS NOT NULL
  AND school_id = public.get_user_school_id(auth.uid())
);

CREATE POLICY "Authors or school admins can update school events"
ON public.school_calendar_events FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.is_school_admin_of(school_id, auth.uid()) OR public.is_admin())
WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.is_admin());

CREATE POLICY "Authors or school admins can delete school events"
ON public.school_calendar_events FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.is_school_admin_of(school_id, auth.uid()) OR public.is_admin());

CREATE TRIGGER trg_school_calendar_events_updated_at
BEFORE UPDATE ON public.school_calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.school_calendar_event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.school_calendar_events(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, teacher_id)
);

CREATE INDEX idx_school_calendar_attendees_teacher ON public.school_calendar_event_attendees(teacher_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_calendar_event_attendees TO authenticated;
GRANT ALL ON public.school_calendar_event_attendees TO service_role;
ALTER TABLE public.school_calendar_event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view school event attendees"
ON public.school_calendar_event_attendees FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.school_calendar_events e
  WHERE e.id = event_id
    AND (e.school_id = public.get_user_school_id(auth.uid()) OR public.is_admin())
));

CREATE POLICY "Event authors manage school event attendees insert"
ON public.school_calendar_event_attendees FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.school_calendar_events e
  WHERE e.id = event_id
    AND (e.created_by = auth.uid() OR public.is_school_admin_of(e.school_id, auth.uid()) OR public.is_admin())
));

CREATE POLICY "Event authors manage school event attendees delete"
ON public.school_calendar_event_attendees FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.school_calendar_events e
  WHERE e.id = event_id
    AND (e.created_by = auth.uid() OR public.is_school_admin_of(e.school_id, auth.uid()) OR public.is_admin())
));