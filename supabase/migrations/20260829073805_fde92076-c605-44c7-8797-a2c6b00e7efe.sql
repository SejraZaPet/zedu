ALTER TABLE public.school_resources
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false;

ALTER TABLE public.resource_reservations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';

ALTER TABLE public.resource_reservations
  DROP CONSTRAINT IF EXISTS resource_reservations_status_check;
ALTER TABLE public.resource_reservations
  ADD CONSTRAINT resource_reservations_status_check
  CHECK (status IN ('confirmed','pending','rejected'));

-- Nová rezervace u položky vyžadující schválení vznikne jako pending
CREATE OR REPLACE FUNCTION public.apply_reservation_approval_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  _requires boolean;
BEGIN
  SELECT requires_approval INTO _requires FROM public.school_resources WHERE id = NEW.resource_id;
  IF COALESCE(_requires, false) AND NEW.status = 'confirmed' THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_apply_reservation_approval_status ON public.resource_reservations;
CREATE TRIGGER trg_apply_reservation_approval_status
BEFORE INSERT ON public.resource_reservations
FOR EACH ROW EXECUTE FUNCTION public.apply_reservation_approval_status();

-- Kolize: pending i confirmed blokují, rejected ne
CREATE OR REPLACE FUNCTION public.check_reservation_conflict()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
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

  IF NEW.returned_at IS NOT NULL OR NEW.status = 'rejected' THEN
    RETURN NEW;
  END IF;

  IF _res.type = 'room' THEN
    SELECT COALESCE(p.first_name || ' ' || p.last_name, p.email, 'jiný učitel')
    INTO _conflict_name
    FROM public.resource_reservations r
    LEFT JOIN public.profiles p ON p.id = r.reserved_by
    WHERE r.resource_id = NEW.resource_id
      AND r.date = NEW.date
      AND r.status <> 'rejected'
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
      AND r.status <> 'rejected'
      AND r.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NEW.time_from < r.time_to
      AND NEW.time_to > r.time_from;

    IF _used + NEW.quantity > _res.total_quantity THEN
      RAISE EXCEPTION 'Nedostatek kusů: v tomto čase je volných jen % z % ks', GREATEST(_res.total_quantity - _used, 0), _res.total_quantity;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Notifikace o výsledku schvalování
CREATE OR REPLACE FUNCTION public.notify_reservation_approval_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  _name text;
BEGIN
  IF OLD.status = NEW.status OR OLD.status <> 'pending' THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('confirmed','rejected') THEN
    RETURN NEW;
  END IF;

  SELECT name INTO _name FROM public.school_resources WHERE id = NEW.resource_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, link, sender_id, sender_role, receiver_type)
  VALUES (
    NEW.reserved_by,
    'system',
    CASE WHEN NEW.status = 'confirmed' THEN 'Rezervace byla schválena' ELSE 'Rezervace byla zamítnuta' END,
    COALESCE(_name, 'Položka') || ' – ' || to_char(NEW.date, 'DD.MM.YYYY') || ' ' ||
      to_char(NEW.time_from, 'HH24:MI') || '–' || to_char(NEW.time_to, 'HH24:MI') ||
      CASE WHEN NEW.status = 'confirmed' THEN '. Administrátor rezervaci schválil.' ELSE '. Administrátor rezervaci zamítl.' END,
    '/ucitel/rezervace',
    auth.uid(),
    'admin',
    'user'
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_reservation_approval_result ON public.resource_reservations;
CREATE TRIGGER trg_notify_reservation_approval_result
AFTER UPDATE OF status ON public.resource_reservations
FOR EACH ROW EXECUTE FUNCTION public.notify_reservation_approval_result();