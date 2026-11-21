# Ukázkový úkol v demu: označit `is_demo_seed = true` (návrh SQL ke schválení)

Nic není aplikováno. Dnes v databázi není žádný ukázkový úkol (ty dřívější byly smazány) a žádný úkol nemá `is_demo_seed = true`.

## Co se změní
1. `demo_seed_pair`: INSERT do `assignments` dostane `is_demo_seed = true`. Pokusy (`assignment_attempts`) ani členství nemají sloupec `is_demo_seed`, ty zůstanou beze změny.
2. Ochrana proti duplicitám: zámek na demo pár + kontrola, zda učitel páru už ukázkový úkol má (pak vrátí jeho ID a nic nevloží). Pojistkou je částečný unikátní index – jeden ukázkový úkol na učitele.
3. **Nutná doprovodná změna `demo_purge_pair`:** úklid dnes záměrně maže jen řádky s `NOT is_demo_seed`. Bez úpravy by se ukázkový úkol a jeho 8 pokusů po konci dema **nesmazaly** (zůstaly by v databázi). Přidáme výslovné smazání ukázkových úkolů patřících učiteli páru (pokusy se smažou kaskádou). Sdílený ukázkový obsah (pracovní listy, učebnice) patří sdíleným účtům, ne páru, takže zůstane.

## Dopady (prohledána všechna použití `is_demo_seed`)
- **Kód aplikace:** žádný filtr úkolů podle `is_demo_seed` neexistuje (použití jen u učebnic, lekcí, listů, prezentací, tříd, exportu a „má vlastní obsah“). Ukázkový úkol se tedy **dál zobrazuje** v seznamech, počtech, výsledcích, Vyhodnocení, Ke kontrole i u demo žáka. Hodnocení pokusů funguje dál (zapisuje se do pokusů, ne do úkolu). Pokud se má úkol v seznamu vizuálně odlišit (např. štítek „Ukázkový“) nebo vynechat z počtů, je to samostatná malá úprava kódu – ke schválení.
- **Demo export a „první vlastní obsah“ (e-mail kontakt):** úkoly nezahrnují, beze změny.
- **Viditelnost:** beze změny – čtení řídí `demo_iso` podle vlastníka a třídy, ne podle příznaku.
- **Změna chování (pozor):** RESTRICTIVE pravidla `demo_guard_update` / `demo_guard_delete` na `assignments` povolují demo učiteli úpravu a mazání jen u `is_demo_seed = false`. Po změně demo učitel **ukázkový úkol nemůže upravit, archivovat ani smazat** (hodnotit pokusy může). To odpovídá ostatnímu ukázkovému obsahu, ale je potřeba, aby to Tyna potvrdila.
- **Úklid / cron:** po úpravě `demo_purge_pair` se smaže stejně jako dnes. Notifikace spolužáků (sdílených účtů) úklid nemaže ani dnes – beze změny.
- **Ostrý (ne-demo) obsah:** nedotčen; index a příznak se týkají jen řádků s `is_demo_seed = true`.

## Navrhované SQL (neaplikovat bez schválení)
```sql
-- 1) Pojistka: nejvýše jeden ukázkový úkol na učitele (dnes 0 řádků, bezpečné)
CREATE UNIQUE INDEX IF NOT EXISTS assignments_one_demo_seed_per_teacher
  ON public.assignments (teacher_id) WHERE is_demo_seed;

-- 2) demo_seed_pair: příznak + ochrana proti duplicitám
CREATE OR REPLACE FUNCTION public.demo_seed_pair(_pair_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
BEGIN
  SELECT * INTO p FROM public.demo_pairs WHERE id = _pair_id;
  IF p IS NULL THEN RAISE EXCEPTION 'pair_not_found'; END IF;
  -- NOVÉ: souběžná volání pro stejný pár se seřadí; existující ukázkový úkol se jen vrátí
  PERFORM pg_advisory_xact_lock(hashtext('demo_seed_pair:' || _pair_id::text));
  SELECT id INTO a_id FROM public.assignments
    WHERE teacher_id = p.teacher_user_id AND is_demo_seed LIMIT 1;
  IF a_id IS NOT NULL THEN RETURN a_id; END IF;

  PERFORM public.demo_fill_game_templates(_pair_id);
  SELECT array_agg(d.user_id ORDER BY pr.email) INTO mates
    FROM public.demo_shared_users d JOIN public.profiles pr ON pr.id = d.user_id WHERE d.kind = 'classmate';
  SELECT id INTO ws_id FROM public.worksheets WHERE is_demo_seed AND title = 'Výživa – opakování (digitální)' ORDER BY created_at LIMIT 1;
  IF ws_id IS NULL OR mates IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.class_members (class_id, user_id) SELECT p.group_id, unnest(mates) ON CONFLICT DO NOTHING;

  INSERT INTO public.assignments (teacher_id, title, description, class_id, worksheet_id, status, deadline, max_attempts, settings, activity_data, is_demo_seed)
  VALUES (p.teacher_user_id, 'Ukázkový úkol: Výživa – opakování', 'Ukázkový úkol pro demo režim. Vyplň digitální pracovní list.',
          p.group_id, ws_id, 'published', now() + interval '14 days', 1, '{}'::jsonb, '[]'::jsonb, true)
  RETURNING id INTO a_id;

  FOR i IN 1 .. LEAST(8, array_length(mates,1)) LOOP
    wrong := wrongs[i:i][1:4];
    ans := jsonb_build_object(
      'dv-1', CASE WHEN 'dv-1' = ANY(wrong) THEN 'B' ELSE 'A' END,
      'dv-2', CASE WHEN 'dv-2' = ANY(wrong) THEN 'B' ELSE 'C' END,
      'dv-3', CASE WHEN 'dv-3' = ANY(wrong) THEN 'C' ELSE 'B' END,
      'dv-4', CASE WHEN 'dv-4' = ANY(wrong) THEN 'A' ELSE 'D' END,
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
END $function$;
```

Změna v `demo_purge_pair` (jediný přidaný blok, celé tělo funkce jinak beze změny; vloží se hned za smazání `demo_contacts`):
```sql
  -- NOVÉ: ukázkový úkol páru (is_demo_seed) patří jen tomuto páru – smazat i s pokusy (kaskáda)
  DELETE FROM public.assignments WHERE teacher_id = ANY(ids) AND is_demo_seed;
  GET DIAGNOSTICS n = ROW_COUNT; total := total || jsonb_build_object('demo_seed_assignments', n);
```
Před aplikací vložím do migrace celý text `CREATE OR REPLACE FUNCTION public.demo_purge_pair` s tímto blokem.

## Otázky pro Tynu
1. Souhlasí, že demo učitel ukázkový úkol nebude moci upravit, archivovat ani smazat (hodnocení pokusů zůstane)?
2. Má se ukázkový úkol v seznamech vizuálně označit / vynechat z počtů? (malá úprava kódu, samostatně)

## Odhad
Migrace + kontrola na novém demu (založení, duplicitní volání, úklid) asi 1–2 hodiny. Nic se nenasazuje.
