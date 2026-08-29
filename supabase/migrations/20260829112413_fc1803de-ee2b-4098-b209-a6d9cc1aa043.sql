CREATE OR REPLACE FUNCTION public.reserve_room_series(
  p_resource_id uuid,
  p_schedule_entry_id uuid,
  p_day_of_week integer,
  p_time_from time,
  p_time_to time,
  p_valid_from date DEFAULT NULL,
  p_valid_to date DEFAULT NULL,
  p_week_parity text DEFAULT 'every',
  p_purpose_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  _conflicts text[] := ARRAY[]::text[];
  _d date;
  _created int := 0;
  _status text;
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

  -- 1) zrušit budoucí rezervace staré série této hodiny (minulé necháváme jako historii)
  IF p_schedule_entry_id IS NOT NULL THEN
    DELETE FROM public.resource_reservations
    WHERE schedule_entry_id = p_schedule_entry_id
      AND date >= CURRENT_DATE;
  END IF;

  -- 2) vygenerovat termíny nové série
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

  -- 3) kontrola kolizí POUZE s cizími rezervacemi (stejná hodina se ignoruje)
  IF _res.type = 'room' THEN
    SELECT array_agg(DISTINCT to_char(x.d, 'DD.MM.YYYY') ORDER BY to_char(x.d, 'DD.MM.YYYY'))
    INTO _conflicts
    FROM unnest(_dates) AS x(d)
    WHERE EXISTS (
      SELECT 1 FROM public.resource_reservations r
      WHERE r.resource_id = p_resource_id
        AND r.date = x.d
        AND r.returned_at IS NULL
        AND COALESCE(r.status, 'confirmed') <> 'rejected'
        AND (p_schedule_entry_id IS NULL OR r.schedule_entry_id IS DISTINCT FROM p_schedule_entry_id)
        AND p_time_from < (r.time_to + make_interval(mins => COALESCE(_res.buffer_minutes, 0)))
        AND (p_time_to + make_interval(mins => COALESCE(_res.buffer_minutes, 0))) > r.time_from
    );

    IF _conflicts IS NOT NULL AND array_length(_conflicts, 1) > 0 THEN
      -- rollback celé operace: stará série zůstane nedotčená
      RAISE EXCEPTION 'Kolize rezervace: místnost je obsazená v těchto termínech: %', array_to_string(_conflicts, ', ');
    END IF;
  END IF;

  _status := CASE WHEN COALESCE(_res.requires_approval, false) THEN 'pending' ELSE 'confirmed' END;

  -- 4) vytvořit novou sérii
  FOREACH _d IN ARRAY _dates LOOP
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
    'requires_approval', COALESCE(_res.requires_approval, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_room_series(uuid, uuid, integer, time, time, date, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_room_series(uuid, uuid, integer, time, time, date, date, text, text) TO authenticated;