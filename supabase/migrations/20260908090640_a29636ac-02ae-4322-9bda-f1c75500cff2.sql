DO $$
DECLARE
  r record;
  l jsonb;
  lst text;
  _start text;
  _end text;
  _parity text;
BEGIN
  FOR r IN SELECT user_id, data::jsonb AS d FROM public.teacher_schedules LOOP
    FOREACH lst IN ARRAY ARRAY['lessonsOdd','lessonsEven','lessonsBoth'] LOOP
      FOR l IN SELECT jsonb_array_elements(COALESCE(r.d->lst, '[]'::jsonb)) LOOP
        CONTINUE WHEN COALESCE(l->>'classId','') = '';
        IF NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = (l->>'classId')::uuid) THEN
          CONTINUE;
        END IF;
        _start := r.d->'periodTimes'->(l->>'period')->>'start';
        _end := r.d->'periodTimes'->(l->>'period')->>'end';
        IF _start IS NULL OR _end IS NULL THEN CONTINUE; END IF;
        _parity := CASE
          WHEN COALESCE((l->>'mirrorBoth')::boolean, false) THEN 'every'
          WHEN lst = 'lessonsBoth' THEN 'every'
          WHEN l->>'weekParity' IN ('odd','even','every') THEN l->>'weekParity'
          WHEN lst = 'lessonsOdd' THEN 'odd'
          ELSE 'even'
        END;

        INSERT INTO public.class_schedule_slots
          (class_id, group_id, subject_label, abbreviation, color, room,
           valid_from, valid_to, week_parity, day_of_week, start_time, end_time, created_by)
        SELECT
          (l->>'classId')::uuid, NULL, NULLIF(l->>'subject',''), NULLIF(l->>'abbreviation',''),
          NULLIF(l->>'color',''), NULLIF(l->>'room',''),
          NULLIF(l->>'validFrom','')::date, NULLIF(l->>'validTo','')::date,
          _parity, (l->>'day')::int + 1, _start::time, _end::time, r.user_id
        WHERE NOT EXISTS (
          SELECT 1 FROM public.class_schedule_slots s
          WHERE s.class_id = (l->>'classId')::uuid
            AND s.day_of_week = (l->>'day')::int + 1
            AND s.start_time = _start::time
            AND COALESCE(s.subject_label,'') = COALESCE(NULLIF(l->>'subject',''),'')
            AND s.week_parity = _parity
        );
      END LOOP;
    END LOOP;
  END LOOP;

  -- odstraň převedené hodiny (s třídou) z osobních rozvrhů
  UPDATE public.teacher_schedules ts
  SET data = (
    SELECT jsonb_set(jsonb_set(jsonb_set(d,
        '{lessonsOdd}', COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements(COALESCE(d->'lessonsOdd','[]'::jsonb)) x WHERE COALESCE(x->>'classId','') = ''), '[]'::jsonb)),
        '{lessonsEven}', COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements(COALESCE(d->'lessonsEven','[]'::jsonb)) x WHERE COALESCE(x->>'classId','') = ''), '[]'::jsonb)),
        '{lessonsBoth}', COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements(COALESCE(d->'lessonsBoth','[]'::jsonb)) x WHERE COALESCE(x->>'classId','') = ''), '[]'::jsonb))
    FROM (SELECT ts.data::jsonb AS d) q
  );
END $$;