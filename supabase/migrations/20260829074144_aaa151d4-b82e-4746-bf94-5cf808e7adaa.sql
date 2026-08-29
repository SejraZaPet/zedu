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
    'info',
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

CREATE OR REPLACE FUNCTION public.notify_reservation_changed_by_other()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
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
    'info',
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
$function$;