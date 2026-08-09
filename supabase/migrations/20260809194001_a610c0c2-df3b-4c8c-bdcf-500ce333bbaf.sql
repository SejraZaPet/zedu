ALTER TABLE public.staff_calendar_events ADD COLUMN IF NOT EXISTS location text;

CREATE TABLE public.staff_event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.staff_calendar_events(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_event_attendees TO authenticated;
GRANT ALL ON public.staff_event_attendees TO service_role;
ALTER TABLE public.staff_event_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Interni pracovnici vidi pozvane"
ON public.staff_event_attendees FOR SELECT TO authenticated
USING (public.is_active_staff(auth.uid()) OR public.is_admin());

CREATE POLICY "Autor udalosti nebo admin spravuje pozvane"
ON public.staff_event_attendees FOR ALL TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.staff_calendar_events e
    WHERE e.id = staff_event_attendees.event_id AND e.created_by = auth.uid()
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.staff_calendar_events e
    WHERE e.id = staff_event_attendees.event_id AND e.created_by = auth.uid()
  )
);

CREATE TABLE public.staff_task_subitems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.staff_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_task_subitems TO authenticated;
GRANT ALL ON public.staff_task_subitems TO service_role;
ALTER TABLE public.staff_task_subitems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pristup k podukolum podle nadrazeneho ukolu"
ON public.staff_task_subitems FOR ALL TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.staff_tasks t
    WHERE t.id = staff_task_subitems.task_id
      AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid())
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.staff_tasks t
    WHERE t.id = staff_task_subitems.task_id
      AND (t.assigned_to = auth.uid() OR t.assigned_by = auth.uid())
  )
);

CREATE TRIGGER update_staff_task_subitems_updated_at
BEFORE UPDATE ON public.staff_task_subitems
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_staff_task_subitems_task ON public.staff_task_subitems(task_id, sort_order);
CREATE INDEX idx_staff_event_attendees_event ON public.staff_event_attendees(event_id);