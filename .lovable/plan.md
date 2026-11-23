# Ukázkový učitelský účet pro návody do Akademie – analýza

Pouze analýza. Kód, DB, RLS ani AGENTS.md se nemění; SQL níže je jen návrh.

## 1. Co dnes demo zakládá
- `demo_seed_pair(_pair_id)` (volá `create-demo-session`): spustí `demo_fill_game_templates` (hry z `demo_game_sources`, 3 zdroje), přidá sdílené spolužáky (`demo_shared_users`, kind=classmate) do skupiny páru (`demo_pairs.group_id`) a založí **1 úkol** „Ukázkový úkol: Výživa – opakování" nad listem „Výživa – opakování (digitální)" s až 8 odevzdanými pokusy (body, zpětná vazba).
- `demo_reset_seed()` jen obnovuje sdílené řádky z `demo_seed_snapshot`: 2 prezentace, 2 pracovní listy, 2 učebnice + 2 lekce, 3 zdroje her.
- **Chybí:** rozvrh (v Demo škole existuje 1 řádek `teacher_schedules`, seed ho nezakládá), všeobecné předměty, druhá třída, materiály, příspěvky na nástěnce, naplánovaný úkol. Vše je jen téma Výživa.

## 2. Co doplnit pro obecnou sadu
- Předměty: Český jazyk, Matematika, Přírodopis, Dějepis, Anglický jazyk, Tělesná výchova – z katalogu `subjects` (duální `subject_id` + text), nové nevytvářet v `textbook_subjects`.
- 2 třídy (`classes`, `class_members`, `class_teachers`, `class_subjects`) s fiktivními žáky `[DEMO]`.
- Rozvrh Po–Pá: `teacher_schedules` (osobní) a/nebo `class_schedule_slots`.
- 4–5 úkolů (`assignments`): 1 s odevzdanými pokusy (`assignment_attempts`), 1 `status='scheduled'` s `publish_at` (cron `publish-due-assignments` by ho jinak zveřejnil – dát datum daleko v budoucnu).
- 3 materiály: `settings.kind='material'`.
- 2 příspěvky na nástěnce: oznámení (`settings` dle `assignment-kind.ts`/`class-wall.ts`).
- 1 pracovní list (`worksheets`), 1 prezentace (`teacher_presentations`).

## 3. Seed vs. samostatný účet
- Úklid (`demo_cleanup_candidates` + `demo_purge_pair`) maže jen účty z `demo_pairs` a šetří řádky `is_demo_seed=true` (existuje v classes, assignments, worksheets, teacher_presentations, subject_groups, teacher_textbooks, textbook_lessons, question_bank_items). `class_members` u seed tříd se nemaže, ale `teacher_schedules`, `class_schedule_slots`, `assignment_comments` sloupec `is_demo_seed` nemají.
- Rozšíření seedu by obsah ukázalo **všem** návštěvníkům (seed je sdílený) – nechceme.
- **Doporučení: samostatný trvalý účet** v Demo škole, **bez** řádku v `demo_pairs` → úklid se ho netýká (14denní mazání neplatí).
- Pozor: účet bude `is_demo_user()=true`, takže platí RESTRICTIVE `demo_iso`/`demo_guard_*`. `demo_visible_user_ids` = on sám + `demo_shared_users` → jeho fiktivní žáci musí být také v Demo škole a viditelní (buď přidat do `demo_shared_users` – pak je uvidí všichni návštěvníci, nebo nevadí, protože ostatní návštěvníci jeho obsah stejně nevidí: `demo_can_see_owned` skryje vlastníka mimo jejich pár). Doporučuji žáky **nedávat** do `demo_shared_users`; ověřit, zda je učitel vidí přes členství ve třídě (může vyžadovat úpravu `demo_can_see_user` – nutná diagnostika).
- Limity zápisu pro demo (`demo_rate_events`, AI guard) se uplatní i na tento účet při tvorbě v UI → hromadně naplnit jednorázovým SQL (service), ne klikáním.
- Alternativa bez demo omezení: účet v běžné (nedemo) testovací škole – screeny by ale nesly jiný název školy.

## 4. Obrázky v Akademii
- Kurzy edituje `AcademyCoursesManager.tsx` přes `src/components/admin/BlockEditor.tsx`; `uploadImageFile` nahrává do veřejného bucketu `lesson-images` (náhodné jméno), do `props.url` jde `getPublicUrl` (trvalá URL).
- Politiky `storage.objects`: INSERT/UPDATE/DELETE pro `is_admin_or_teacher()`, SELECT veřejný → **admin smí nahrávat z editoru**.

## Návrh SQL (jen text, nespouštět bez schválení)
```text
-- 1) Účet vytvořit přes create-school-user (Demo škola 126d6ab4-…), role teacher, e-mail ucitel.navody@…
-- 2) Fiktivní žáci stejně (role user), jména [DEMO] Jan Novák …
-- 3) Obsah, vše s is_demo_seed=true tam, kde sloupec existuje:
INSERT INTO classes (name, school_id, created_by, is_demo_seed, ...) VALUES ('6.A', '<demo_school>', '<teacher>', true, ...);
INSERT INTO class_members (class_id, user_id) SELECT '<class>', id FROM profiles WHERE ... ;
INSERT INTO assignments (teacher_id, class_id, title, status, publish_at, settings, is_demo_seed)
  VALUES ('<teacher>','<class>','Zlomky','scheduled', now()+interval '1 year','{}', true),
         ('<teacher>','<class>','Básně – materiál','published', NULL,'{"kind":"material"}', true),
         ('<teacher>','<class>','Výlet v pátek','published', NULL,'{"kind":"announcement","wall":true}', true);
INSERT INTO teacher_schedules (user_id, ...) VALUES ('<teacher>', '<JSON Po–Pá>');
```
Přesné sloupce (publish_at, klíče nástěnky, formát rozvrhu) ověřit před napsáním migrace/skriptu.

## Další krok po schválení
Diagnostika viditelnosti žáků pro tento účet (`demo_can_see_user`), pak přesný jednorázový skript ke schválení.
