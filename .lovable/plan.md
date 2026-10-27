# Balíček ke schválení: J2 + I2a + I2b-2 + I2c/I2d + I3 (NIC NESPUŠTĚNO)

Jedno schválení „schvaluji balíček“ spustí celý obsah v pořadí z oddílu F. Bez něj se nic nespustí. Pokud kterýkoli krok selže, zastavím se a další kroky nespouštím. Migraci po neúspěchu nebudu opakovat.

## Pro učitelku stručně
- **A – zrušené hodiny do budoucna:** v dialogu zrušení nebo přesunu hodiny budou dvě zaškrtávátka, obě ve výchozím stavu zapnutá: „Ukázat změnu žákům a rodičům“ a „Ukázat i důvod“. Soukromá poznámka se žákům nikdy neukáže.
- **B, C, D – testovací žák neviditelný:** nebude v seznamech třídy a skupin, v losování, týmech, statistikách, přehledech školy, upozorněních rodičům, e-mailech, exportech ani ve výsledcích her, které spustí někdo jiný.
- **E – testovací žák ve vašich třídách:** při každém přepnutí na testovacího žáka ho systém zařadí do všech vašich aktivních tříd a skupin. Ze tříd, které už nejsou vaše, ho odebere. Uvidí učebnice, úkoly, rozvrh, hry a sešity jako skutečný žák.
- **Vrácení všeho:** jeden společný postup v oddílu F.

## Ověřený stav (čteno 27. 10. 2026)
- `class_members(id, class_id, user_id, created_at)`, UNIQUE(class_id,user_id), FK s ON DELETE CASCADE na `classes` i `profiles`.
- `subject_group_members(id, group_id, student_id, created_at)`, sloupec je **`student_id`**, FK s CASCADE na `subject_groups` i `profiles`. Na tabulce chybí unikátní index (group_id, student_id).
- `preview_students(student_id PK, owner_id UNIQUE, created_at)` má 0 řádků. Funkce `is_preview_student(_uid)` existuje (SQL, STABLE, DEFINER).
- `profiles`: PERMISSIVE `profiles_select_scoped` (sám, admin, školní admin své školy, `is_teacher_of_student`, `is_parent_of_student`) + `Active staff…` + RESTRICTIVE `demo_iso`.
- Triggery na členství: jen `_trg_course_notebooks`, tedy založení sešitů, což je žádoucí.
- `save_schedule_exception` zapisuje `visible_to_students=false` (při vložení i přepsání) a `_share` ignoruje. `reason_visible` nezapisuje vůbec, takže zůstává DB default false. `student_schedule_changes` už `reason_visible` respektuje.
- Admin s vlastními třídami: jeden účet (12 aktivních tříd, 7 skupin), další dva admini 0 / 0.

---

## A) J2 – zveřejnění změn rozvrhu

### Proč druhý příznak řeší samostatná funkce
Signatura `save_schedule_exception` zůstává beze změny (15 parametrů), takže druhý parametr přidat nelze. `reason_visible` proto nastaví nová malá funkce. Při uložení se důvod vždy nejdřív bezpečně skryje (false) a klient ho hned potom zveřejní, pokud je zaškrtnuto „Ukázat i důvod“. Když druhé volání selže, žák uvidí jen „Zrušeno“ bez důvodu. Důvod se tedy nikdy neukáže omylem.

### A1. `save_schedule_exception` – přesné změny (vše ostatní 1:1 podle současné definice)
Postup: `pg_get_functiondef` současné verze se uloží do `drizzle/migrations/<n>_j2_rollback.sql` (rollback). Nová verze vznikne těmito třemi náhradami. Jinde se nic nemění.

1. Větev `reverted`, původně:
```sql
 UPDATE public.schedule_exceptions SET state='reverted',visible_to_students=false,revision=revision+1,request_id=_request_id,updated_at=now() WHERE id=old_ex.id RETURNING * INTO ex;
```
nově:
```sql
 UPDATE public.schedule_exceptions SET state='reverted',visible_to_students=false,reason_visible=false,revision=revision+1,request_id=_request_id,updated_at=now() WHERE id=old_ex.id RETURNING * INTO ex;
```
2. INSERT, původně:
```sql
 INSERT INTO public.schedule_exceptions(owner_id,source_kind,source_id,class_slot_id,original_date,action,state,new_date,new_start,new_end,class_id,group_id,visible_to_students,public_reason,request_id)
 VALUES(auth.uid(),_kind,_source_id,CASE WHEN _kind='class_slot' THEN _source_id::uuid END,_original_date,_action,'active',CASE WHEN _action='moved' THEN _new_date END,CASE WHEN _action='moved' THEN _new_start END,CASE WHEN _action='moved' THEN _new_end END,(src->>'class_id')::uuid,(src->>'group_id')::uuid,false,coalesce(_reason,''),_request_id)
```
nově:
```sql
 INSERT INTO public.schedule_exceptions(owner_id,source_kind,source_id,class_slot_id,original_date,action,state,new_date,new_start,new_end,class_id,group_id,visible_to_students,reason_visible,public_reason,request_id)
 VALUES(auth.uid(),_kind,_source_id,CASE WHEN _kind='class_slot' THEN _source_id::uuid END,_original_date,_action,'active',CASE WHEN _action='moved' THEN _new_date END,CASE WHEN _action='moved' THEN _new_start END,CASE WHEN _action='moved' THEN _new_end END,(src->>'class_id')::uuid,(src->>'group_id')::uuid,coalesce(_share,true),false,coalesce(_reason,''),_request_id)
```
(`_action` je zde vždy `cancelled` nebo `moved`, protože `reverted` skončil výše.)
3. ON CONFLICT, původně `…,visible_to_students=false,public_reason=excluded.public_reason,…`, nově:
```sql
…,visible_to_students=excluded.visible_to_students,reason_visible=false,public_reason=excluded.public_reason,…
```

### A2. Nová funkce pro „Ukázat i důvod“
```sql
CREATE OR REPLACE FUNCTION public.set_schedule_exception_reason_visible(_exception_id uuid, _visible boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.schedule_exceptions e
     SET reason_visible = coalesce(_visible,false) AND e.visible_to_students,
         updated_at = now()
   WHERE e.id = _exception_id AND e.owner_id = auth.uid() AND e.state = 'active'
     AND public.schedule_demo_access(e.owner_id, e.class_id, e.group_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_schedule_exception_reason_visible(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_schedule_exception_reason_visible(uuid, boolean) TO authenticated;
```
`revision` se úmyslně nemění, aby souběžná editace nehlásila „Hodina se mezitím změnila“. Před spuštěním ověřím signaturu `schedule_demo_access(uuid,uuid,uuid)` přes `pg_proc`. Pokud se liší, zastavím se.

Rollback A:
```sql
DROP FUNCTION IF EXISTS public.set_schedule_exception_reason_visible(uuid, boolean);
-- + spustit uložený soubor <n>_j2_rollback.sql (původní save_schedule_exception 1:1)
```
Data zapsaná mezitím zůstanou. Pokud je potřeba skrýt všechny nové změny: `UPDATE public.schedule_exceptions SET visible_to_students=false, reason_visible=false WHERE updated_at > '<čas spuštění>';` (jen po vašem schválení).

### A3. Aplikace
- `ScheduleExceptionDialog.tsx`: pod polem „Důvod“ dvě zaškrtávátka s popiskem a min. 44px plochou. „Ukázat změnu žákům a rodičům“ (výchozí zapnuto) a „Ukázat i důvod“ (výchozí zapnuto, vypnuté a neaktivní, když je první vypnuté). Při úpravě existující změny se předvyplní z uloženého `visible_to_students` / `reason_visible`. Nápověda: „Soukromá poznámka se žákům nikdy nezobrazí.“
- `schedule-exception-store.ts`: `_share: params.share ?? true` místo `false`. Po úspěšném uložení `rpc('set_schedule_exception_reason_visible', { _exception_id, _visible: share && showReason })`. Při chybě toast „Změna je uložená, důvod se žákům zatím nezobrazuje.“ Typ řádku dostane `reason_visible`.
- Testy (vitest): výchozí hodnoty true/true, vypnutí prvního vypne druhé, store posílá `_share`, při neúspěchu setteru se změna neruší.

---

## B) I2a OPRAVENÁ – RLS

### Posouzení RESTRICTIVE na `profiles`
- **Výkon:** `is_preview_student(id)` je dotaz přes primární klíč malé tabulky (0–3 řádky), STABLE. U výpisu stovek profilů to přidá zanedbatelné mikrosekundy na řádek. Nižší riziko než stávající `demo_iso`.
- **Správa uživatelů (admin):** testovacího žáka uvidí jen jeho vlastník, ostatní admini ne. To je záměr.
- **Školní admin:** testovací žák nemá `school_id`, takže ho školní admin neviděl ani dřív. Pojistka: v E se při každém přepnutí nastaví `school_id = NULL`.
- **Riziko:** jediné nové omezení dopadá na spoluvyučující tříd vlastníka (přes `is_teacher_of_student`). Ti testovacího žáka neuvidí, což je cíl. Zápisové politiky se nemění.
- **Bezpečnější varianta (doporučuji):** politika jen pro SELECT, výraz začíná levnou kontrolou `id = auth.uid()`, DEFINER funkce mají pevný `search_path`. Úprava sdílené `is_teacher_of_student` by se dotkla desítek politik, proto ji nenavrhuji.

### SQL I2a
```sql
CREATE OR REPLACE FUNCTION public.is_preview_owner(_student uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.preview_students WHERE student_id = _student AND owner_id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.is_preview_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_preview_owner(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_preview_student_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT student_id FROM public.preview_students WHERE owner_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.my_preview_student_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_preview_student_ids() TO authenticated;

CREATE POLICY preview_hide_class_members ON public.class_members AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR NOT public.is_preview_student(user_id) OR public.is_preview_owner(user_id));
CREATE POLICY preview_hide_group_members ON public.subject_group_members AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR NOT public.is_preview_student(student_id) OR public.is_preview_owner(student_id));
CREATE POLICY preview_hide_profiles ON public.profiles AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR NOT public.is_preview_student(id) OR public.is_preview_owner(id));
```
Oproti dřívějšímu návrhu: u skupin opraven sloupec na `student_id`. U členství vidí testovacího žáka i vlastník, aby admin poznal, kde testovací žák je. V učitelských seznamech ho v D skryje klient.

Rollback B:
```sql
DROP POLICY IF EXISTS preview_hide_class_members ON public.class_members;
DROP POLICY IF EXISTS preview_hide_group_members ON public.subject_group_members;
DROP POLICY IF EXISTS preview_hide_profiles ON public.profiles;
DROP FUNCTION IF EXISTS public.my_preview_student_ids();
DROP FUNCTION IF EXISTS public.is_preview_owner(uuid);
```

---

## C) I2b-2 – pět funkcí
Signatury, návratové typy, oprávnění i SECURITY DEFINER zůstávají. Mění se jen jedna podmínka v každé funkci. Postup pro přesný rollback: těsně před migrací uložím `pg_get_functiondef` všech pěti do `drizzle/migrations/<n>_i2b2_rollback.sql` a zapíšu jejich md5. Po rollbacku musí md5 sedět.

### C1. `notify_on_class_story()` (trigger `trg_class_story_notify`)
Původní poslední podmínka:
```sql
  WHERE cm.class_id = NEW.class_id
    AND psl.parent_id <> NEW.teacher_id;
```
nová:
```sql
  WHERE cm.class_id = NEW.class_id
    AND psl.parent_id <> NEW.teacher_id
    AND NOT public.is_preview_student(psl.student_id);
```

### C2. `notify_on_class_textbook_added()` (trigger `trg_class_textbook_added`)
Původní blok žáků:
```sql
  WHERE cm.class_id = NEW.class_id
    AND cm.user_id <> _actor
    AND NOT public.is_teaching_staff(cm.user_id);
```
nový:
```sql
  WHERE cm.class_id = NEW.class_id
    AND cm.user_id <> _actor
    AND NOT public.is_teaching_staff(cm.user_id)
    AND NOT public.is_preview_student(cm.user_id);
```
Blok učitelů beze změny.

### C3. `class_engagement_stats(_class_id uuid)`
CTE `students`, původně:
```sql
    WHERE cm.class_id = _class_id
  ),
  class_assignments AS (
```
nově:
```sql
    WHERE cm.class_id = _class_id
      AND NOT public.is_preview_student(cm.user_id)
  ),
  class_assignments AS (
```

### C4. `school_engagement_overview(_school_id uuid)`
CTE `members`, původně:
```sql
    JOIN public.class_members cm ON cm.class_id = cl.id
    LEFT JOIN auth.users u ON u.id = cm.user_id
  ),
```
nově:
```sql
    JOIN public.class_members cm ON cm.class_id = cl.id
    LEFT JOIN auth.users u ON u.id = cm.user_id
    WHERE NOT public.is_preview_student(cm.user_id)
  ),
```
`avg_recent` počítá z `assignment_attempts` všech pokusů třídy, proto i tam:
```sql
          AND aa.max_score > 0) AS avg_recent
```
→
```sql
          AND aa.max_score > 0
          AND NOT public.is_preview_student(aa.student_id)) AS avg_recent
```

### C5. `school_overview_stats(_school_id uuid)`
CTE `school_users`, původně:
```sql
    WHERE p.school_id = _school_id
  ),
```
nově:
```sql
    WHERE p.school_id = _school_id
      AND NOT public.is_preview_student(p.id)
  ),
```
(Testovací žák nemá školu, takže jde jen o pojistku. Licence a aktivita vycházejí ze `school_users`.)

Rollback C: spustit `<n>_i2b2_rollback.sql` (původních 5 definic 1:1) a ověřit md5.

---

## D) I2c + I2d – bez DB
**Server** (sdílený `_shared/preview-students.ts`, načte ID přes service role, s krátkou mezipamětí):
- `detect-student-alerts`, `notify-parent`, `_shared/reminder-targets.ts` (auto-reminders): přeskočí testovací ID.
- `export-session-csv`, `export-session-report`: vynechají řádky testovacích hráčů, pokud hru nespustil vlastník (u vlastní hry zůstanou se štítkem „Testovací žák“).
- `send-email`, `notify-email`, `send-push`: tvrdá blokace adres končících `@preview.invalid` a příjemců z `preview_students`. Vrátí `skipped`, ne chybu.
- `join-game`, `submit-answer`, bodování: beze změny.

**Klient** (`src/lib/preview-students.ts`: `excludePreviewStudents(rows, ids)` + hook přes `my_preview_student_ids()`):
- lobby a výsledky živé hry, exporty skládané v prohlížeči: skrýt testovací ID, u vlastníka zobrazit štítek „Testovací žák“.
- učitelské seznamy třídy a skupin, losování a týmy: skrýt i u vlastníka (DB mu je kvůli kontrole ukazuje).

Testy: vitest pro `excludePreviewStudents` a Deno testy pro filtr a blokaci e-mailu. Rollback D: vrátit soubory, žádné nasazení bez vašeho pokynu.

---

## E) I3 – automatické zařazení (až po A–D)
V `preview-student-switch` po ověření vlastníka (service role):
```text
1. owner_classes = classes nearchivované, ne is_demo_seed, kde created_by = owner
                  NEBO existuje class_teachers(class_id, user_id = owner)
2. owner_groups  = subject_groups nearchivované, ne is_demo_seed, created_by = owner
3. upsert class_members(class_id, user_id=student) ON CONFLICT (class_id,user_id) DO NOTHING
4. subject_group_members: vložit jen chybějící (UNIQUE chybí → předem SELECT)
5. smazat členství testovacího žáka ve třídách/skupinách mimo owner_classes/owner_groups
6. profiles.school_id testovacího žáka = NULL (pojistka), audit_log 'preview_student_sync'
```
Úklid při smazání třídy nebo skupiny zajistí existující ON DELETE CASCADE. Archivace nebo odebrání učitelky se srovná při dalším přepnutí. Sešity vzniknou existujícím triggerem. Žádná změna DB v E. Pro dnešní stav: 1 admin, 12 tříd, 7 skupin.

Rollback E: vrátit edge funkci a smazat jen členství testovacího žáka:
```sql
DELETE FROM public.class_members WHERE user_id IN (SELECT student_id FROM public.preview_students);
DELETE FROM public.subject_group_members WHERE student_id IN (SELECT student_id FROM public.preview_students);
```
(datový zápis, jen po vašem schválení; maže pouze data testovacího žáka)

---

## F) Pořadí, kontroly, testy, vrácení

| Krok | Co | Kontrola po kroku | Při chybě |
|---|---|---|---|
| 1 | Uložit rollback soubory (originály + md5) | soubory existují | stop |
| 2 | Migrace B (I2a) | `pg_policies` má 3 nové RESTRICTIVE; EXECUTE jen authenticated/service_role | stop |
| 3 | Migrace C (I2b-2) | `prosrc` všech 5 obsahuje `is_preview_student`; signatury beze změny | stop |
| 4 | Migrace A (J2) | `prosrc` obsahuje `coalesce(_share,true)`; nová funkce, EXECUTE jen authenticated | stop |
| 5 | Kód A, D (dialog, store, server, klient) + testy celé sady | vitest/Deno zelené, tsgo čisté | opravit kód, DB nevracet |
| 6 | Kód E | test synchronizace (mock) | stop |

Kontrolní SELECTy:
```sql
SELECT count(*) FROM public.preview_students;                       -- očekávám 0
SELECT policyname, permissive FROM pg_policies WHERE policyname LIKE 'preview_hide_%';
SELECT proname, md5(pg_get_functiondef(oid)) FROM pg_proc WHERE proname IN
 ('save_schedule_exception','class_engagement_stats','school_engagement_overview','school_overview_stats','notify_on_class_textbook_added','notify_on_class_story');
SELECT count(*) FROM public.schedule_exceptions WHERE visible_to_students;  -- beze změny (24)
SELECT count(*) FROM public.class_members;                                   -- před = po (bez E)
```

Testy v prohlížeči (po kódu, bez nasazení):
- **Učitelka:** zruší testovací hodinu `[TEST]` se zapnutými volbami, změní ji na „bez důvodu“ a pak ji vrátí. Ve třídě a skupině není testovací žák, losování funguje, přehled třídy a školy se načte.
- **Testovací žák (po E):** vidí třídy, učebnice, úkoly, rozvrh se „Zrušeno“ a důvodem, sešit, hru. V žebříčku ani lize není.
- **Rodič:** vidí „Zrušeno“ a důvod, soukromou poznámku nevidí.
- Testovací záznamy označím `[TEST]` a po testu smažu jen ty, které jsem vytvořila.

### Jedno společné „vrácení všeho“ (opačné pořadí)
1. Vrátit soubory kódu (E, D, A).
2. Pouze po schválení: DELETE členství testovacího žáka (oddíl E).
3. `DROP FUNCTION public.set_schedule_exception_reason_visible(uuid, boolean);` + `<n>_j2_rollback.sql`.
4. `<n>_i2b2_rollback.sql`.
5. Rollback B (3× DROP POLICY, 2× DROP FUNCTION).
6. Kontrola md5 a `pg_policies` proti kroku 1.

## Shrnutí změn
**Databáze:** 3 nové RESTRICTIVE politiky čtení (`class_members`, `subject_group_members`, `profiles`), 3 nové funkce (`is_preview_owner`, `my_preview_student_ids`, `set_schedule_exception_reason_visible`), 6 upravených funkcí (`save_schedule_exception` + 5 z I2b-2). Žádné nové tabulky ani sloupce, žádná změna stávajících dat. Členství testovacího žáka zapisuje až aplikace v E.
**Aplikace:** dialog zrušení hodiny (2 zaškrtávátka), ukládání změn rozvrhu, filtry testovacího žáka v serverových funkcích, e-mailech, exportech, hrách a učitelských seznamech, synchronizace tříd v přepínači testovacího žáka.
**Beze změny:** demo ochrany, bodování a XP, stálý rozvrh, úkoly a plány, 24 zveřejněných zrušení. Nic se nenasazuje.

Nic z tohoto balíčku nespustím bez výslovného „schvaluji balíček“ od učitelky.
