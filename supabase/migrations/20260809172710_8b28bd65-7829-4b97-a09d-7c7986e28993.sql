CREATE OR REPLACE FUNCTION public.is_active_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members
    WHERE profile_id = _user_id AND active = true
  );
$$;

CREATE TABLE public.staff_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  assigned_to uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  due_date date,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_tasks TO authenticated;
GRANT ALL ON public.staff_tasks TO service_role;

ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view own or assigned tasks"
ON public.staff_tasks FOR SELECT TO authenticated
USING (assigned_to = auth.uid() OR assigned_by = auth.uid() OR public.is_admin());

CREATE POLICY "Staff can create tasks they own or assign"
ON public.staff_tasks FOR INSERT TO authenticated
WITH CHECK (
  (assigned_by = auth.uid() AND (public.is_active_staff(auth.uid()) OR public.is_admin()))
  OR public.is_admin()
);

CREATE POLICY "Staff can update own or assigned tasks"
ON public.staff_tasks FOR UPDATE TO authenticated
USING (assigned_to = auth.uid() OR assigned_by = auth.uid() OR public.is_admin())
WITH CHECK (assigned_to = auth.uid() OR assigned_by = auth.uid() OR public.is_admin());

CREATE POLICY "Staff can delete own or assigned tasks"
ON public.staff_tasks FOR DELETE TO authenticated
USING (assigned_by = auth.uid() OR assigned_to = auth.uid() OR public.is_admin());

CREATE TRIGGER update_staff_tasks_updated_at
BEFORE UPDATE ON public.staff_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.staff_calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_calendar_events TO authenticated;
GRANT ALL ON public.staff_calendar_events TO service_role;

ALTER TABLE public.staff_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view all events"
ON public.staff_calendar_events FOR SELECT TO authenticated
USING (public.is_active_staff(auth.uid()) OR public.is_admin());

CREATE POLICY "Internal staff can create events"
ON public.staff_calendar_events FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (public.is_active_staff(auth.uid()) OR public.is_admin()));

CREATE POLICY "Authors or admins can update events"
ON public.staff_calendar_events FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.is_admin())
WITH CHECK (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "Authors or admins can delete events"
ON public.staff_calendar_events FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.is_admin());

CREATE TRIGGER update_staff_calendar_events_updated_at
BEFORE UPDATE ON public.staff_calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_staff_tasks_assigned_to ON public.staff_tasks(assigned_to);
CREATE INDEX idx_staff_calendar_events_start ON public.staff_calendar_events(start_time);