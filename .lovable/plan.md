# Více pracovních listů a lekcí u Úkolu i Materiálu – diagnostika a návrh

Pouze návrh. Nic se neimplementuje bez výslovného „schvaluji“.

## 1. Co je dnes (ověřeno čtením kódu a DB)

- Úloha má jeden list `assignments.worksheet_id` a jednu lekci `lesson_id` + `lesson_source`.
- Pro plány už existuje `settings.lessons` (pole `{id, source, title}`) s čtením přes `planLessons()` v `planned-assignment.ts`. Ta funkce se při prázdném poli vrací k `lesson_id`. Používají ji `StudentAssignmentPlayer`, `StudentAssignments`, `StudentSubjectClass` a `UpcomingExamsCard`.
- Kdo čte `worksheet_id`:
  - `StudentAssignmentPlayer`: načtení listu, vložení do sešitu, odevzdání přes `worksheet-attempt.ts`, kde je jeden pokus a jedno `answers`.
  - `TeacherResults`: spec listu pro hodnocení a přebodování.
  - `StudentSubjectClass`, `AssignmentDetailDialog`, `lesson-plan-student.ts`.
  - `_shared/reminder-targets.ts` a `auto-reminders-job`: rozhodují, zda je plán „bez obsahu“.
- Rodičovský přehled pracuje jen s pokusy, list ani lekci nečte. E-maily o novém úkolu list ani lekci neuvádějí.
- **Oprávnění:**
  - Žák smí číst list jen přes politiku „Students can read worksheets via assignment“, která kontroluje `a.worksheet_id = worksheets.id`. **List uložený jen v `settings` by žák neotevřel.** Více listů proto nejde čistě frontendem. Potřeba je jedna nová, pouze rozšiřující politika ke čtení.
  - Lekce v `settings.lessons` už u plánů fungují. Ještě je nutné ověřit, že funkce `can_view_*_textbook_lesson` povolí i lekci, která není v `lesson_id`.
- **Vedlejší bezpečnostní nález (neopravovat bez schválení):**
  - Stávající politika obsahuje `OR a.class_id IS NULL`. Zveřejněný list u úlohy pro skupinu (bez třídy) tak může číst kdokoli přihlášený.
  - Do politiky chybí i kontrola `assignment_recipients`.

## 2. Ukládání

- Lekce se ukládají do `settings.lessons`, tedy do stejného tvaru a stejné čtecí funkce jako u plánů. `lesson_id` zůstává jako první lekce, takže staré čtečky dál fungují.
- Listy se ukládají do `settings.worksheets: [{id, title}]` v pořadí, jak je učitelka seřadí. Do `worksheet_id` se zapisuje vždy první list.
- Nová funkce `assignmentWorksheets(a)` vrací pole listů. Bez `settings.worksheets` vrátí `[worksheet_id]`, takže staré záznamy fungují beze změny.
- Minimální změna DB, jen jako NÁVRH a NESPOUŠTĚT:

```sql
CREATE OR REPLACE FUNCTION public.can_student_view_assignment_worksheet(_ws uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM assignments a
    WHERE a.status = 'published'
      AND a.settings->'worksheets' @> jsonb_build_array(jsonb_build_object('id', _ws::text))
      AND (
        EXISTS (SELECT 1 FROM class_members cm WHERE cm.class_id = a.class_id AND cm.user_id = _uid)
        OR EXISTS (SELECT 1 FROM subject_group_members g WHERE g.group_id = a.group_id AND g.user_id = _uid)
      )
      AND (NOT EXISTS (SELECT 1 FROM assignment_recipients r WHERE r.assignment_id = a.id)
           OR EXISTS (SELECT 1 FROM assignment_recipients r WHERE r.assignment_id = a.id AND r.student_id = _uid))
  ) $$;
GRANT EXECUTE ON FUNCTION public.can_student_view_assignment_worksheet(uuid, uuid) TO authenticated;
CREATE POLICY "Students can read extra assignment worksheets" ON public.worksheets
  FOR SELECT TO authenticated USING (public.can_student_view_assignment_worksheet(id, auth.uid()));
-- Rollback:
-- DROP POLICY "Students can read extra assignment worksheets" ON public.worksheets;
-- DROP FUNCTION public.can_student_view_assignment_worksheet(uuid, uuid);
```

Názvy sloupců u `subject_group_members` a `assignment_recipients` se před spuštěním ověří čtecím dotazem. Politika jen přidává čtení a stávající práva nemění. Demo RESTRICTIVE politiky platí dál.

## 3. Úkol a více listů – varianty

**A) Hlavní list + další listy k vyplnění bez bodů**
- První list se odevzdává a hodnotí jako dnes.
- Další listy žák otevře a vyplní ve svém sešitu nebo uložené práci, ale do výsledků se nepočítají.
- Výhoda: nulové riziko pro odevzdání, výsledky a hodnocení.
- Nevýhoda: učitelka by u dalších listů neviděla body, což se blíží variantě, kterou odmítla.

**B) Každý list jako samostatná část jednoho pokusu (doporučeno)**
- Odpovědi se ukládají v `answers` po listech: `answers.sheets[worksheetId]`. Starý tvar s jedním listem zůstává čitelný.
- Skóre pokusu je součet všech listů, `max_score` je součet maxim.
- `TeacherResults` ukazuje přebodování po listech.
- Žák list po listu prochází přepínačem „List 1 / 2 / 3“ a odevzdává jednou za celek.
- Dopady:
  - Mění se hodnoticí cesty (`worksheet-attempt.ts`, přehrávač, `TeacherResults`, statistiky, export výsledků).
  - Vkládání do sešitu a snapshoty se musí vázat na konkrétní list.
  - Rozpracované pokusy ze staré verze se čtou jako list 1.
- Riziko: střední. Každá hodnoticí cesta proto dostane test na starý i nový tvar.

**C) Zamítnuto:** samostatná úloha pro každý list (duplicita, víc notifikací).

## 4. Materiál

- Všechny listy a lekce jsou jen k otevření a nic se neodevzdává.
- Pro listy platí stejná politika z bodu 2.
- Lekce se otevírají jako dnes.

## 5. UI – sdílený blok „Pracovní listy a lekce“

- Stejný blok pro Úkol i Materiál, u Oznámení se dál nezobrazuje.
- Seznam položek s ikonou typu, názvem, šipkami nahoru/dolů (ovládání klávesnicí, bez tahání) a tlačítkem Odebrat.
- „Přidat list“ a „Přidat lekci“ otevírají stávající `SearchableSelect`, hledání funguje od 8 položek. Už vybrané položky se znovu nenabízejí.
- Na mobilu (390 px) je seznam pod sebou, ovládací prvky mají aspoň 44 px a stránka se do strany neposouvá.
- Při úpravě starého záznamu se blok naplní z `worksheet_id`/`lesson_id`. Bez zásahu učitelky se nic nepřepisuje.
- Na kartách u učitele a v žákovském seznamu se zobrazí „3 listy, 2 lekce“.

## 6. Etapy

1. **Frontend, bez DB:**
   - Více lekcí u úkolu i materiálu přes `settings.lessons`.
   - Sdílený blok, u listů zatím jen jeden.
   - Testy: čtení starých i nových záznamů, řazení, odebrání.
2. **Schválení SQL z bodu 2 a teprve potom** více listů u Materiálu (jen k otevření).
3. Více listů u Úkolu podle zvolené varianty (doporučena B) včetně výsledků, přebodování a exportu.
4. Volitelně: oprava nálezu `class_id IS NULL` (samostatné schválení).

Testy:
- `assignmentWorksheets` a `planLessons` pro staré i nové záznamy
- neutralizace podle druhu
- skóre B: součet, starý tvar `answers`, přebodování po listech
- `isPlanWithoutContent` s `settings.worksheets`
- mobil 390 px

## Technické soubory

- `assignment-kind.ts`, `planned-assignment.ts`, nový `assignment-content.ts`
- `TeacherAssignments.tsx` a nová komponenta `AssignmentContentPicker`
- `StudentAssignmentPlayer.tsx`, `worksheet-attempt.ts`, `TeacherResults.tsx`
- `StudentSubjectClass.tsx`, `AssignmentDetailDialog.tsx`
- `_shared/reminder-targets.ts`: jen čtení listů, nasazení edge funkce až na pokyn

## Otevřené otázky

1. Varianta B (všechny listy hodnocené, jedno odevzdání), nebo A?
2. Schvalujete SQL z bodu 2, nebo začneme etapou 1 jen s lekcemi?
3. Má se v rámci etapy 4 opravit nalezená mezera ve čtení listů u skupinových úloh?
