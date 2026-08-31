CREATE OR REPLACE FUNCTION public.reserve_room_series(
  p_resource_id uuid,
  p_schedule_entry_id uuid,
  p_day_of_week integer,
  p_time_from time without time zone,
  p_time_to time without time zone,
  p_valid_from date DEFAULT NULL::date,
  p_valid_to date DEFAULT NULL::date,
  p_week_parity text DEFAULT 'every'::text,
  p_purpose_note text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _res public.school_resources;
  _group uuid := gen_random_uuid();
  _start date;
  _end date;
  _dates date[] := ARRAY[]::date[];
  _cursor date;
  _parity text := COALESCE(p_week_parity, 'every');
  _week int;
  _skipped text[] := ARRAY[]::text[];
  _d date;
  _created int := 0;
  _kept int := 0;
  _status text;
  _default_status text;
  _existing_total int := 0;
  _existing_mismatch int := 0;
  _prev_confirmed date[] := ARRAY[]::date[];
  _conflict boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Nepřihlášený uživatel';
  END IF;
  IF NOT public.can_reserve_resources(_uid) THEN
    RAISE EXCEPTION 'Nemáte oprávnění rezervovat zdroje';
  END IF;

  SELECT * INTO _res FROM public.school_resources WHERE id = p_resource_id;
  IF _res IS NULL THEN
    RAISE EXCEPTION 'Zdroj neexistuje';
  END IF;

  -- 0) Nezměnilo se nic podstatného? (stejný zdroj, den i čas) → nechat rezervace být.
  SELECT
    count(*),
    count(*) FILTER (
      WHERE r.resource_id IS DISTINCT FROM p_resource_id
         OR r.time_from IS DISTINCT FROM p_time_from
         OR r.time_to IS DISTINCT FROM p_time_to
         OR EXTRACT(ISODOW FROM r.date)::int IS DISTINCT FROM p_day_of_week
    )
  INTO _existing_total, _existing_mismatch
  FROM public.resource_reservations r
  WHERE p_schedule_entry_id IS NOT NULL
    AND r.schedule_entry_id = p_schedule_entry_id
    AND r.date >= CURRENT_DATE
    AND COALESCE(r.status, 'confirmed') <> 'rejected';

  IF _existing_total > 0 AND _existing_mismatch = 0 THEN
    -- Jen kosmetická změna hodiny: aktualizujeme maximálně popisku.
    UPDATE public.resource_reservations
       SET purpose_note = COALESCE(p_purpose_note, purpose_note)
     WHERE schedule_entry_id = p_schedule_entry_id
       AND date >= CURRENT_DATE;

    RETURN jsonb_build_object(
      'recurrence_group_id', (
        SELECT recurrence_group_id FROM public.resource_reservations
        WHERE schedule_entry_id = p_schedule_entry_id AND date >= CURRENT_DATE
        LIMIT 1
      ),
      'created', 0,
      'kept', _existing_total,
      'unchanged', true,
      'skipped_dates', ARRAY[]::text[],
      'requires_approval', COALESCE(_res.requires_approval, false)
    );
  END IF;

  -- 1) Zapamatovat si termíny, které už byly schválené, aby po přegenerování
  --    zůstaly schválené (schvalování se vyžaduje jen pro NOVÉ termíny).
  IF p_schedule_entry_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(r.date), ARRAY[]::date[])
    INTO _prev_confirmed
    FROM public.resource_reservations r
    WHERE r.schedule_entry_id = p_schedule_entry_id
      AND r.date >= CURRENT_DATE
      AND r.resource_id = p_resource_id
      AND COALESCE(r.status, 'confirmed') = 'confirmed';

    DELETE FROM public.resource_reservations
    WHERE schedule_entry_id = p_schedule_entry_id
      AND date >= CURRENT_DATE;
  END IF;

  -- 2) Vygenerovat termíny nové série
  _start := GREATEST(COALESCE(p_valid_from, CURRENT_DATE), CURRENT_DATE);
  _end := COALESCE(
    p_valid_to,
    make_date(CASE WHEN EXTRACT(MONTH FROM _start) >= 8
                   THEN EXTRACT(YEAR FROM _start)::int + 1
                   ELSE EXTRACT(YEAR FROM _start)::int END, 6, 30)
  );

  _cursor := _start;
  WHILE EXTRACT(ISODOW FROM _cursor)::int <> p_day_of_week LOOP
    _cursor := _cursor + 1;
  END LOOP;

  WHILE _cursor <= _end AND array_length(_dates, 1) IS DISTINCT FROM 60 LOOP
    _week := EXTRACT(WEEK FROM _cursor)::int;
    IF _parity = 'every'
       OR (_parity = 'odd' AND _week % 2 = 1)
       OR (_parity = 'even' AND _week % 2 = 0) THEN
      _dates := _dates || _cursor;
    END IF;
    _cursor := _cursor + 7;
  END LOOP;

  _default_status := CASE WHEN COALESCE(_res.requires_approval, false) THEN 'pending' ELSE 'confirmed' END;

  -- 3) Vytvořit rezervace pro VŠECHNY volné termíny; obsazené jen přeskočit.
  FOREACH _d IN ARRAY _dates LOOP
    _conflict := false;

    IF _res.type = 'room' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.resource_reservations r
        WHERE r.resource_id = p_resource_id
          AND r.date = _d
          AND r.returned_at IS NULL
          AND COALESCE(r.status, 'confirmed') <> 'rejected'
          AND (p_schedule_entry_id IS NULL OR r.schedule_entry_id IS DISTINCT FROM p_schedule_entry_id)
          AND p_time_from < (r.time_to + make_interval(mins => COALESCE(_res.buffer_minutes, 0)))
          AND (p_time_to + make_interval(mins => COALESCE(_res.buffer_minutes, 0))) > r.time_from
      ) INTO _conflict;
    END IF;

    IF _conflict THEN
      _skipped := _skipped || to_char(_d, 'DD.MM.YYYY');
      CONTINUE;
    END IF;

    -- Termín už dříve schválený zůstává schválený.
    IF _d = ANY (_prev_confirmed) THEN
      _status := 'confirmed';
      _kept := _kept + 1;
    ELSE
      _status := _default_status;
    END IF;

    INSERT INTO public.resource_reservations
      (resource_id, reserved_by, date, time_from, time_to, quantity,
       purpose_note, schedule_entry_id, recurrence_group_id, status)
    VALUES
      (p_resource_id, _uid, _d, p_time_from, p_time_to, 1,
       p_purpose_note, p_schedule_entry_id, _group, _status);
    _created := _created + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'recurrence_group_id', _group,
    'created', _created,
    'kept', _kept,
    'unchanged', false,
    'total', COALESCE(array_length(_dates, 1), 0),
    'skipped_dates', COALESCE(_skipped, ARRAY[]::text[]),
    'requires_approval', COALESCE(_res.requires_approval, false)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reserve_room_series(uuid, uuid, integer, time without time zone, time without time zone, date, date, text, text) TO authenticated, service_role;