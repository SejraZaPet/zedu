CREATE OR REPLACE FUNCTION public.demo_reset_seed()
RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; cols text; cnt int := 0; n int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  FOR s IN SELECT * FROM public.demo_seed_snapshot ORDER BY
      CASE table_name WHEN 'teacher_textbooks' THEN 1 WHEN 'teacher_textbook_lessons' THEN 2 ELSE 3 END LOOP
    SELECT string_agg(format('%I', column_name), ',') INTO cols
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=s.table_name AND column_name <> 'id' AND is_generated = 'NEVER';
    EXECUTE format('UPDATE public.%I t SET (%s) = (SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1)) WHERE t.id = $2',
                   s.table_name, cols, cols, s.table_name) USING s.data, s.row_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN
      EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)', s.table_name, s.table_name) USING s.data;
    END IF;
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END $$;