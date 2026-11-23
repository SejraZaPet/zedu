# Ukázkový učitelský účet pro návody do Akademie – ZŠ Testovací, Praha

Jen návrh. Nic se nespouští, kód, DB ani AGENTS.md se nemění. Škola: `e83c8907-8f6e-40ff-9203-1146320ac936` (is_demo=false).

## Ověřeno v DB (jen čtení, 23. 11. 2026)
- `classes`: name, description, school, school_id, year, created_by, archived (bez CHECK).
- `class_members(class_id, user_id)`, `class_teachers(class_id, user_id, role default 'co_teacher')`.
- `class_subjects(class_id, subject_id, school_year default '2026/2027')`.
- `subjects(name, color, abbreviation, school_id, created_by)`. V globálním katalogu existují jen **Český jazyk** (`fcf418de-…`) a **Matematika** (`89ce25f5-…`). Přírodopis, Dějepis, Anglický jazyk a Tělesná výchova chybí, proto se založí jako školní předměty (`school_id` = testovací škola), ne do `textbook_subjects`.
- `class_schedule_slots`: day_of_week 1–7, week_parity in (every, odd, even), end_time > start_time, právě jedno z class_id/group_id.
- `teacher_schedules(user_id PK, data jsonb)`: `periodTimes`, `periods`, `breaks`, `parityMode:'both'`, `lessonsBoth[]` s položkami `{id, day, period, classId, className, subject, abbreviation, color, room, validFrom, validTo, mirrorBoth}`.
- `assignments`: status text bez CHECK (používá se draft/published/scheduled), `scheduled_publish_at`, `subject_id`, `worksheet_id`, třída XOR skupina, exam_type ∈ (ustni, pisemne, digitalni, projekt, prace_v_hodine) nebo NULL.
- Nástěnka: `settings = {"kind":"announcement","wallPost":true,"pinned":false,"notifyEmail":false,"commentsEnabled":true}`. Materiál: `{"kind":"material", ...}`.
- `assignment_attempts.status` v datech: in_progress, submitted; hodnocení je v `score`, `max_score`, `teacher_feedback_text/emoji/at/by`.
- `worksheets`: status ∈ (draft, published, scheduled), worksheet_mode ∈ (classwork, homework, test, revision, exam, project).
- `teacher_presentations(teacher_id, title, slides jsonb)`, slide `{slideId, type, layout, projector:{headline, body, assetRefs}, device, blocks, teacherNotes}`.

## 1. Účty (nejde SQL, auth uživatele zakládá jen služba)
- `create-school-user` smí volat jen **school_admin**, jehož `profiles.school_id` je cílová škola. Role jen `user`/`teacher`. Až 300 řádků, hesla generuje sám, žáky zapíše do třídy podle kódu třídy, uloží přihlašovací heslo (`set_login_password`) a PIN. E-mail posílá jen na skutečné adresy, generované (`@bezli-student.cz`, `@bezli-lektor.cz`) se přeskakují.
- Tyna jako admin do této školy nepatří, takže funkci přímo zavolat nemůže. Postup:
  1. V admin Uživatelích založit (nebo dočasně přiřadit) technického správce školy pro ZŠ Testovací. Přiřazení role a školy je zápis, který schvalujete zvlášť.
  2. Jako tento správce na `/skola` hromadně importovat: 1 učitel a 12 žáků (6 × 6.A, 6 × 7.B).
  3. Hesla se zobrazí jen jednou v tisku přihlašovacích údajů v UI. Do chatu, logů ani secrets je nedávat. Později je admin uvidí v Uživatelích (`get_login_password`).
  4. Tyna se přihlásí jako ukázkový učitel jeho jménem a heslem v anonymním okně. Funkce „přihlásit se jako uživatel“ pro učitele neexistuje, `preview-student-switch` je jen pro náhledové žáky.
- Po importu se z DB přečtou UUID učitele, žáků a tříd a doplní se do proměnných níže.

## 2. Skript (text, psql proměnné)
Označení: všechny názvy začínají `[AKADEMIE]`, třídy a předměty mají v popisu nebo zkratce `AKADEMIE`. Data se dají smazat podle učitele, protože celý obsah patří jeho účtu.

```sql
-- \set t  '<uuid učitele>'   \set s 'e83c8907-8f6e-40ff-9203-1146320ac936'
-- \set c6 '<uuid 6.A>'       \set c7 '<uuid 7.B>'  (nebo založit níže, pokud import třídy nevytvořil)
BEGIN;
INSERT INTO classes (name, description, school, school_id, year, created_by)
VALUES ('6.A','[AKADEMIE] ukázková třída','ZŠ Testovací, Praha',:'s',6,:'t'),
       ('7.B','[AKADEMIE] ukázková třída','ZŠ Testovací, Praha',:'s',7,:'t');
-- (pokud třídy vznikly importem: UPDATE classes SET description='[AKADEMIE] ukázková třída', created_by=:'t' WHERE id IN (:'c6',:'c7');)
INSERT INTO class_teachers (class_id, user_id, role) VALUES (:'c6',:'t','owner'),(:'c7',:'t','owner');
-- žáci: class_members zakládá import; jinak INSERT INTO class_members(class_id,user_id) VALUES ...

INSERT INTO subjects (name, color, abbreviation, school_id, created_by) VALUES
 ('Přírodopis','#4ADE80','PŘ',:'s',:'t'),('Dějepis','#F59E0B','D',:'s',:'t'),
 ('Anglický jazyk','#60A5FA','AJ',:'s',:'t'),('Tělesná výchova','#F472B6','TV',:'s',:'t');

INSERT INTO class_subjects (class_id, subject_id)
SELECT c, s.id FROM unnest(ARRAY[:'c6',:'c7']::uuid[]) c,
  subjects s WHERE s.id IN ('fcf418de-830b-4d76-ad95-947a156e9678','89ce25f5-b720-4351-8a8b-fbd60d52cef5')
   OR (s.school_id=:'s' AND s.created_by=:'t');

-- Rozvrh třídy Po–Pá, 1.–4. hodina (časy jako v teacher_schedules)
INSERT INTO class_schedule_slots (class_id, day_of_week, start_time, end_time, subject_id, subject_label, abbreviation, created_by, valid_from, valid_to)
SELECT x.cls, x.d, x.st, x.en, s.id, s.name, s.abbreviation, :'t', '2026-09-01','2027-06-30'
FROM (VALUES
 (:'c6'::uuid,1,'08:00'::time,'08:45'::time,'Český jazyk'),(:'c6',1,'08:55','09:40','Matematika'),
 (:'c7',1,'09:50','10:35','Dějepis'),(:'c7',2,'08:00','08:45','Anglický jazyk'),
 (:'c6',2,'08:55','09:40','Přírodopis'),(:'c7',3,'08:00','08:45','Matematika'),
 (:'c6',3,'09:50','10:35','Tělesná výchova'),(:'c7',4,'08:00','08:45','Český jazyk'),
 (:'c6',4,'08:55','09:40','Anglický jazyk'),(:'c7',5,'08:00','08:45','Přírodopis'),
 (:'c6',5,'09:50','10:35','Dějepis')) x(cls,d,st,en,nm)
JOIN subjects s ON s.name=x.nm AND (s.school_id=:'s' OR s.school_id IS NULL) AND NOT s.archived;

-- Osobní rozvrh učitele (stejné hodiny ve formátu teacher_schedules)
INSERT INTO teacher_schedules (user_id, data) VALUES (:'t', jsonb_build_object(
 'parityMode','both','periods','[1,2,3,4,5,6,7,8]'::jsonb,'lessonsOdd','[]'::jsonb,'lessonsEven','[]'::jsonb,
 'breaks','[{"afterPeriod":3,"durationMin":20,"notes":{}}]'::jsonb,
 'periodTimes','{"1":{"start":"08:00","end":"08:45"},"2":{"start":"08:55","end":"09:40"},"3":{"start":"09:50","end":"10:35"},"4":{"start":"10:55","end":"11:40"}}'::jsonb,
 'lessonsBoth', jsonb_build_array(
  jsonb_build_object('id','ak1','day',1,'period',1,'classId',:'c6','className','6.A','subject','Český jazyk','abbreviation','ČJ','color','#6EC6D9','room','','validFrom','2026-09-01','validTo','2027-06-30','mirrorBoth',false),
  jsonb_build_object('id','ak2','day',1,'period',2,'classId',:'c6','className','6.A','subject','Matematika','abbreviation','M','color','#9B6CFF','room','','validFrom','2026-09-01','validTo','2027-06-30','mirrorBoth',false)
  -- … další položky stejně pro zbývající sloty výše
 )));

-- Pracovní list a prezentace
INSERT INTO worksheets (teacher_id, title, subject, subject_id, grade_band, worksheet_mode, status, spec)
VALUES (:'t','[AKADEMIE] Zlomky – procvičení','Matematika','89ce25f5-b720-4351-8a8b-fbd60d52cef5','6','classwork','published',
 '{"version":1,"header":{"title":"Zlomky – procvičení"},"items":[]}'::jsonb)
RETURNING id;  -- => :w   (obsah úloh doplnit raději v editoru, viz bod 4)
INSERT INTO teacher_presentations (teacher_id, title, slides) VALUES (:'t','[AKADEMIE] Středověk – úvod', jsonb_build_array(
 jsonb_build_object('slideId','ak-s1','type','intro','layout','title-only','blocks','[]'::jsonb,'device','{}'::jsonb,'teacherNotes','',
   'projector',jsonb_build_object('headline','Středověk','body','Úvod do tématu','assetRefs','[]'::jsonb)),
 jsonb_build_object('slideId','ak-s2','type','content','layout','title-only','blocks','[]'::jsonb,'device','{}'::jsonb,'teacherNotes','',
   'projector',jsonb_build_object('headline','Hrady a zámky','body','Proč vznikaly hrady?','assetRefs','[]'::jsonb)),
 jsonb_build_object('slideId','ak-s3','type','content','layout','title-only','blocks','[]'::jsonb,'device','{}'::jsonb,'teacherNotes','',
   'projector',jsonb_build_object('headline','Shrnutí','body','Tři věci, které si pamatuji','assetRefs','[]'::jsonb))));

-- 5 úkolů
INSERT INTO assignments (teacher_id, class_id, subject_id, title, description, status, deadline, worksheet_id, settings, scheduled_publish_at) VALUES
 (:'t',:'c6','89ce25f5-b720-4351-8a8b-fbd60d52cef5','[AKADEMIE] Zlomky – pracovní list','Vyplň pracovní list.','published', now()+interval '7 days', :'w','{"kind":"task"}',NULL),
 (:'t',:'c6','fcf418de-830b-4d76-ad95-947a156e9678','[AKADEMIE] Vyjmenovaná slova po B','Doplň i/y.','published', now()+interval '3 days', NULL,'{"kind":"task"}',NULL),
 (:'t',:'c7',(SELECT id FROM subjects WHERE name='Dějepis' AND school_id=:'s'),'[AKADEMIE] Referát o hradu','Krátký referát.','published', now()+interval '14 days',NULL,'{"kind":"task"}',NULL),
 (:'t',:'c7',(SELECT id FROM subjects WHERE name='Anglický jazyk' AND school_id=:'s'),'[AKADEMIE] Slovíčka Unit 3','Nauč se slovíčka.','draft', NULL,NULL,'{"kind":"task"}',NULL),
 (:'t',:'c6',(SELECT id FROM subjects WHERE name='Přírodopis' AND school_id=:'s'),'[AKADEMIE] Naplánovaný úkol','Zveřejní se později.','scheduled', '2099-06-30 12:00+00',NULL,'{"kind":"task"}','2099-06-01 06:00+00');
-- 3 materiály
INSERT INTO assignments (teacher_id, class_id, subject_id, title, description, status, settings) VALUES
 (:'t',:'c6','89ce25f5-b720-4351-8a8b-fbd60d52cef5','[AKADEMIE] Materiál: Tahák ke zlomkům','Pro opakování.','published','{"kind":"material"}'),
 (:'t',:'c7',(SELECT id FROM subjects WHERE name='Dějepis' AND school_id=:'s'),'[AKADEMIE] Materiál: Časová osa','Ke stažení.','published','{"kind":"material"}'),
 (:'t',:'c6','fcf418de-830b-4d76-ad95-947a156e9678','[AKADEMIE] Materiál: Pravidla psaní i/y','Přehled.','published','{"kind":"material"}');
-- 2 příspěvky na nástěnce
INSERT INTO assignments (teacher_id, class_id, title, description, status, settings) VALUES
 (:'t',:'c6','[AKADEMIE] Výlet do ZOO','<p>V pátek jedeme do ZOO.</p>','published','{"kind":"announcement","wallPost":true,"pinned":true,"notifyEmail":false,"commentsEnabled":true}'),
 (:'t',:'c7','[AKADEMIE] Připomínka: přezůvky','<p>Nezapomeňte přezůvky.</p>','published','{"kind":"announcement","wallPost":true,"pinned":false,"notifyEmail":false,"commentsEnabled":true}');

-- Odevzdané a ohodnocené pokusy (4 žáci 6.A) k úkolu „Zlomky“
INSERT INTO assignment_attempts (assignment_id, student_id, status, answers, score, max_score, submitted_at, teacher_feedback_text, teacher_feedback_emoji, teacher_feedback_at, teacher_feedback_by)
SELECT a.id, m.user_id, 'submitted', '{}'::jsonb, 6 + (row_number() over ())::int % 4, 10, now()-interval '1 day',
       'Pěkná práce.', '👍', now(), :'t'
FROM assignments a JOIN LATERAL (SELECT user_id FROM class_members WHERE class_id=:'c6' LIMIT 4) m ON true
WHERE a.teacher_id=:'t' AND a.title='[AKADEMIE] Zlomky – pracovní list';
COMMIT;
```

Poznámky:
- `scheduled_publish_at` 2099 a cron `publish-due-assignments` ho nezveřejní.
- `notifyEmail:false`, takže se nepošlou e-maily. Insert úkolů může spustit triggery notifikací. Žáci jsou fiktivní a mají zástupné e-maily, proto se na skutečné adresy nic nepošle. Před spuštěním je potřeba ověřit triggery na `assignments`.
- `answers` je prázdný objekt, takže v detailu pokusu nejsou vidět konkrétní odpovědi. Pro screen s odpověďmi je lepší nechat 1–2 žáky odevzdat v UI.

## 3. Mazání (jedním blokem, podle učitele a školy)
```sql
BEGIN;
DELETE FROM assignment_attempts WHERE assignment_id IN (SELECT id FROM assignments WHERE teacher_id=:'t');
DELETE FROM assignments          WHERE teacher_id=:'t';
DELETE FROM worksheets           WHERE teacher_id=:'t';
DELETE FROM teacher_presentations WHERE teacher_id=:'t';
DELETE FROM teacher_schedules    WHERE user_id=:'t';
DELETE FROM class_schedule_slots WHERE created_by=:'t';
DELETE FROM class_subjects       WHERE class_id IN (SELECT id FROM classes WHERE school_id=:'s' AND description LIKE '[AKADEMIE]%');
DELETE FROM class_members        WHERE class_id IN (SELECT id FROM classes WHERE school_id=:'s' AND description LIKE '[AKADEMIE]%');
DELETE FROM class_teachers       WHERE class_id IN (SELECT id FROM classes WHERE school_id=:'s' AND description LIKE '[AKADEMIE]%');
DELETE FROM classes              WHERE school_id=:'s' AND description LIKE '[AKADEMIE]%';
DELETE FROM subjects             WHERE school_id=:'s' AND created_by=:'t';
COMMIT;
```
Účty (učitel, 12 žáků a technický správce) se mažou přes admin Uživatele, protože auth záznamy SQL mazat nelze. Před mazáním je potřeba zkontrolovat, že učitel nevytvořil v UI nic dalšího (notifikace, XP, avatary, sešity), a případně rozšířit seznam.

## 4. Co nejde SQL nebo je lepší v UI
- Založení auth účtů, hesel a PINů: `create-school-user` přes `/skola`. Hesla se zobrazí jen jednou v UI.
- Role a školu technického správce nastavuje admin v Uživatelích.
- Obsah pracovního listu (úlohy, správné odpovědi) a vzhled prezentace: editor, aby `spec` a slidy odpovídaly aktuálním validátorům.
- Žákovské odpovědi k realistickému detailu pokusu: přihlásit se jako žák a odevzdat.
- Obrázky do Akademie: nahrát v BlockEditoru (`lesson-images`).
- Sešity žáků vzniknou samy při členství (`ensure_my_course_notebooks`).

## Ke schválení
1. Zda smím založit technického správce pro ZŠ Testovací (zápis do rolí a profilu).
2. Zda spustit skript výše (zápis do DB) po importu účtů.
