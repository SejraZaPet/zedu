CREATE POLICY demo_seed_read ON public.worksheets FOR SELECT TO authenticated
  USING (is_demo_seed AND public.is_demo_user(auth.uid()));
CREATE POLICY demo_seed_read ON public.teacher_presentations FOR SELECT TO authenticated
  USING (is_demo_seed AND public.is_demo_user(auth.uid()));
CREATE POLICY demo_seed_read ON public.teacher_textbooks FOR SELECT TO authenticated
  USING (is_demo_seed AND public.is_demo_user(auth.uid()));
CREATE POLICY demo_seed_read ON public.teacher_textbook_lessons FOR SELECT TO authenticated
  USING (public.is_demo_user(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.teacher_textbooks t WHERE t.id = teacher_textbook_lessons.textbook_id AND t.is_demo_seed));

CREATE OR REPLACE FUNCTION public.demo_seed_pair(_pair_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p record; ws_id uuid; a_id uuid; mates uuid[]; i int; ans jsonb; wrong text[]; auto int; open_pts int;
  open_txt text[] := ARRAY[
    'Ovesná kaše s ovocem a jogurtem a k tomu čaj. Má sacharidy na energii, bílkoviny z jogurtu a vitamíny z ovoce.',
    'Celozrnný chleba se sýrem a zeleninou. Je tam pečivo, mléčný výrobek i zelenina.',
    'Müsli s mlékem a jablko, protože to zasytí a dodá energii na celé dopoledne.',
    'Rohlík s nutelou.',
    'Vajíčko, chleba a rajče – mám tam bílkoviny i zeleninu.',
    'Nesnídám.',
    'Jogurt s vločkami a banán.',
    'Toust se šunkou.'];
  wrongs text[][] := ARRAY[
    ARRAY['','','',''], ARRAY['dv-6','','',''], ARRAY['dv-4','dv-6','',''], ARRAY['dv-3','dv-8','',''],
    ARRAY['dv-2','dv-6','',''], ARRAY['dv-1','dv-4','dv-6','dv-8'], ARRAY['dv-3','dv-7','',''], ARRAY['dv-4','dv-6','dv-8','']];
  open_grade int[] := ARRAY[3,2,2,NULL,1,NULL,NULL,1];
  fb text[] := ARRAY['Výborně, Terezo! Snídaně je pestrá a skvěle zdůvodněná.', 'Moc pěkné, Jakube. Pozor jen na pitný režim – je to víc než půl litru.', NULL, NULL,
    'Dobrá práce, Natálie. Zkus příště doplnit, proč je snídaně vyvážená.', NULL, NULL, NULL];
  scores int[] := ARRAY[]::int[];
BEGIN
  SELECT * INTO p FROM public.demo_pairs WHERE id = _pair_id;
  IF p IS NULL THEN RAISE EXCEPTION 'pair_not_found'; END IF;
  SELECT array_agg(d.user_id ORDER BY pr.email) INTO mates
    FROM public.demo_shared_users d JOIN public.profiles pr ON pr.id = d.user_id WHERE d.kind = 'classmate';
  SELECT id INTO ws_id FROM public.worksheets WHERE is_demo_seed AND title = 'Výživa – opakování (digitální)' ORDER BY created_at LIMIT 1;
  IF ws_id IS NULL OR mates IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.class_members (class_id, user_id) SELECT p.group_id, unnest(mates) ON CONFLICT DO NOTHING;

  INSERT INTO public.assignments (teacher_id, title, description, class_id, worksheet_id, status, deadline, max_attempts, settings, activity_data)
  VALUES (p.teacher_user_id, 'Ukázkový úkol: Výživa – opakování', 'Ukázkový úkol pro demo režim. Vyplň digitální pracovní list.',
          p.group_id, ws_id, 'published', now() + interval '14 days', 1, '{}'::jsonb, '[]'::jsonb)
  RETURNING id INTO a_id;

  FOR i IN 1 .. LEAST(8, array_length(mates,1)) LOOP
    wrong := wrongs[i:i][1:4];
    ans := jsonb_build_object(
      'dv-1', CASE WHEN 'dv-1' = ANY(wrong) THEN 'Bílkoviny' ELSE 'Sacharidy' END,
      'dv-2', CASE WHEN 'dv-2' = ANY(wrong) THEN 'Maso a ryby' ELSE 'Obiloviny, pečivo, rýže a těstoviny' END,
      'dv-3', CASE WHEN 'dv-3' = ANY(wrong) THEN '2× denně' ELSE '5× denně v menších porcích' END,
      'dv-4', CASE WHEN 'dv-4' = ANY(wrong) THEN 'Vitamín C' ELSE 'Vitamín D' END,
      'dv-5', 'true',
      'dv-6', CASE WHEN 'dv-6' = ANY(wrong) THEN 'true' ELSE 'false' END,
      'dv-7', CASE WHEN 'dv-7' = ANY(wrong) THEN 'false' ELSE 'true' END,
      'dv-8', CASE WHEN 'dv-8' = ANY(wrong) THEN '["Bílkoviny","Sacharidy","Tuky"]'::jsonb ELSE '["Sacharidy","Bílkoviny","Tuky"]'::jsonb END,
      'dv-9', open_txt[i]);
    auto := 10 - (SELECT count(*) FROM unnest(wrong) w WHERE w <> '' AND w <> 'dv-8')::int
               - CASE WHEN 'dv-8' = ANY(wrong) THEN 3 ELSE 0 END;
    open_pts := COALESCE(open_grade[i], 0);
    INSERT INTO public.assignment_attempts (assignment_id, student_id, attempt_number, status, answers, score, max_score,
      started_at, submitted_at, last_saved_at, progress, teacher_feedback_text, teacher_feedback_at, teacher_feedback_by)
    VALUES (a_id, mates[i], 1, 'submitted', ans, auto + open_pts, 13,
      now() - interval '1 day' - (i || ' minutes')::interval, now() - interval '1 day' + (i || ' minutes')::interval, now() - interval '1 day',
      jsonb_build_object('completed', '["dv-1","dv-2","dv-3","dv-4","dv-5","dv-6","dv-7","dv-8","dv-9"]'::jsonb, 'currentIndex', 8),
      fb[i], CASE WHEN fb[i] IS NULL THEN NULL ELSE now() END, CASE WHEN fb[i] IS NULL THEN NULL ELSE p.teacher_user_id END);
  END LOOP;
  RETURN a_id;
END $$;
REVOKE ALL ON FUNCTION public.demo_seed_pair(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_seed_pair(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';