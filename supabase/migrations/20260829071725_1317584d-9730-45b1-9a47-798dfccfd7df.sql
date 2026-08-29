-- ===== school_resources =====
CREATE TABLE public.school_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('room','inventory')),
  name text NOT NULL,
  description text,
  building text,
  floor text,
  room_number text,
  total_quantity integer NOT NULL DEFAULT 1 CHECK (total_quantity >= 0),
  location_note text,
  photo_url text,
  condition_status text NOT NULL DEFAULT 'ok' CHECK (condition_status IN ('ok','repair','retired')),
  buffer_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_resources TO authenticated;
GRANT ALL ON public.school_resources TO service_role;

ALTER TABLE public.school_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view resources"
ON public.school_resources FOR SELECT TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()) OR public.is_admin());

CREATE POLICY "Admins can insert resources"
ON public.school_resources FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.is_school_admin_of(school_id, auth.uid()));

CREATE POLICY "Admins can update resources"
ON public.school_resources FOR UPDATE TO authenticated
USING (public.is_admin() OR public.is_school_admin_of(school_id, auth.uid()))
WITH CHECK (public.is_admin() OR public.is_school_admin_of(school_id, auth.uid()));

CREATE POLICY "Admins can delete resources"
ON public.school_resources FOR DELETE TO authenticated
USING (public.is_admin() OR public.is_school_admin_of(school_id, auth.uid()));

CREATE TRIGGER update_school_resources_updated_at
BEFORE UPDATE ON public.school_resources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_school_resources_school_type ON public.school_resources(school_id, type);

-- ===== resource_reservations =====
CREATE TABLE public.resource_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.school_resources(id) ON DELETE CASCADE,
  reserved_by uuid NOT NULL,
  date date NOT NULL,
  time_from time NOT NULL,
  time_to time NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  purpose_note text,
  schedule_entry_id uuid REFERENCES public.class_schedule_slots(id) ON DELETE SET NULL,
  recurrence_group_id uuid,
  returned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_reservations TO authenticated;
GRANT ALL ON public.resource_reservations TO service_role;

ALTER TABLE public.resource_reservations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_reservation(_reservation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resource_reservations r
    JOIN public.school_resources sr ON sr.id = r.resource_id
    WHERE r.id = _reservation_id
      AND (
        r.reserved_by = auth.uid()
        OR public.is_admin()
        OR public.is_school_admin_of(sr.school_id, auth.uid())
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.resource_in_my_school(_resource_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_resources sr
    WHERE sr.id = _resource_id
      AND (sr.school_id = public.get_user_school_id(auth.uid()) OR public.is_admin())
  )
$$;

CREATE POLICY "School members can view reservations"
ON public.resource_reservations FOR SELECT TO authenticated
USING (public.resource_in_my_school(resource_id));

CREATE POLICY "Teachers can create own reservations"
ON public.resource_reservations FOR INSERT TO authenticated
WITH CHECK (reserved_by = auth.uid() AND public.resource_in_my_school(resource_id));

CREATE POLICY "Owner or admin can update reservations"
ON public.resource_reservations FOR UPDATE TO authenticated
USING (public.can_manage_reservation(id))
WITH CHECK (public.resource_in_my_school(resource_id));

CREATE POLICY "Owner or admin can delete reservations"
ON public.resource_reservations FOR DELETE TO authenticated
USING (public.can_manage_reservation(id));

CREATE TRIGGER update_resource_reservations_updated_at
BEFORE UPDATE ON public.resource_reservations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_resource_reservations_resource_date ON public.resource_reservations(resource_id, date);
CREATE INDEX idx_resource_reservations_recurrence ON public.resource_reservations(recurrence_group_id);

-- ===== kontrola kolizí =====
CREATE OR REPLACE FUNCTION public.check_reservation_conflict()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET row_security = off
AS $$
DECLARE
  _res public.school_resources;
  _conflict_name text;
  _used integer;
BEGIN
  SELECT * INTO _res FROM public.school_resources WHERE id = NEW.resource_id;
  IF _res IS NULL THEN
    RAISE EXCEPTION 'Zdroj neexistuje';
  END IF;

  IF NEW.time_to <= NEW.time_from THEN
    RAISE EXCEPTION 'Čas do musí být pozdější než čas od';
  END IF;

  IF _res.condition_status = 'retired' THEN
    RAISE EXCEPTION 'Tato položka je vyřazená a nelze ji rezervovat';
  END IF;

  IF NEW.returned_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF _res.type = 'room' THEN
    SELECT COALESCE(p.first_name || ' ' || p.last_name, p.email, 'jiný učitel')
    INTO _conflict_name
    FROM public.resource_reservations r
    LEFT JOIN public.profiles p ON p.id = r.reserved_by
    WHERE r.resource_id = NEW.resource_id
      AND r.date = NEW.date
      AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NEW.time_from < (r.time_to + make_interval(mins => _res.buffer_minutes))
      AND (NEW.time_to + make_interval(mins => _res.buffer_minutes)) > r.time_from
    LIMIT 1;

    IF _conflict_name IS NOT NULL THEN
      RAISE EXCEPTION 'Kolize rezervace: místnost je v tomto čase obsazená (%)', _conflict_name;
    END IF;
  ELSE
    SELECT COALESCE(SUM(r.quantity), 0) INTO _used
    FROM public.resource_reservations r
    WHERE r.resource_id = NEW.resource_id
      AND r.date = NEW.date
      AND r.returned_at IS NULL
      AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NEW.time_from < r.time_to
      AND NEW.time_to > r.time_from;

    IF _used + NEW.quantity > _res.total_quantity THEN
      RAISE EXCEPTION 'Nedostatek kusů: v tomto čase je volných jen % z % ks', GREATEST(_res.total_quantity - _used, 0), _res.total_quantity;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_reservation_conflict
BEFORE INSERT OR UPDATE OF resource_id, date, time_from, time_to, quantity
ON public.resource_reservations
FOR EACH ROW EXECUTE FUNCTION public.check_reservation_conflict();

-- ===== notifikace při zásahu do cizí rezervace =====
CREATE OR REPLACE FUNCTION public.notify_reservation_changed_by_other()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public SET row_security = off
AS $$
DECLARE
  _actor uuid := auth.uid();
  _row public.resource_reservations;
  _name text;
BEGIN
  _row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  IF _actor IS NULL OR _actor = _row.reserved_by THEN
    RETURN _row;
  END IF;

  SELECT name INTO _name FROM public.school_resources WHERE id = _row.resource_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, link, sender_id, sender_role, receiver_type)
  VALUES (
    _row.reserved_by,
    'system',
    CASE WHEN TG_OP = 'DELETE' THEN 'Vaše rezervace byla zrušena' ELSE 'Vaše rezervace byla změněna' END,
    COALESCE(_name, 'Položka') || ' – ' || to_char(_row.date, 'DD.MM.YYYY') || ' ' ||
      to_char(_row.time_from, 'HH24:MI') || '–' || to_char(_row.time_to, 'HH24:MI') ||
      CASE WHEN TG_OP = 'DELETE' THEN '. Rezervaci zrušil administrátor.' ELSE '. Rezervaci upravil administrátor.' END,
    '/ucitel/rezervace',
    _actor,
    'admin',
    'user'
  );

  RETURN _row;
END;
$$;

CREATE TRIGGER trg_notify_reservation_deleted
AFTER DELETE ON public.resource_reservations
FOR EACH ROW EXECUTE FUNCTION public.notify_reservation_changed_by_other();

CREATE TRIGGER trg_notify_reservation_updated
AFTER UPDATE OF date, time_from, time_to, resource_id
ON public.resource_reservations
FOR EACH ROW EXECUTE FUNCTION public.notify_reservation_changed_by_other();