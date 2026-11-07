# Úkol jen pro vybrané žáky – diagnostika a návrh (nic neimplementováno)

## 1. Jak dnes funguje cílení (ověřeno v kódu a DB)

- `assignments` má jen `class_id`, `group_id`, `subject_id` a `settings` (jsonb). **Žádné pole pro jednotlivé žáky neexistuje** – v kódu ani DB není `assignment_targets`, `assigned_students` ani `settings.studentIds`. (`group_mode`/`assignment_groups` jsou pracovní týmy v úkolu, ne výběr příjemců.)
- Viditelnost pro žáka = RLS na `assignments`:
  - „Students can read assigned assignments": `status='published'` a (`class_id IS NULL AND group_id IS NULL` **nebo** žák je v `class_members` třídy).
  - „Students can read group assignments": `published` a žák je v `subject_group_members`.
  - RESTRICTIVE `demo_iso` (+ `demo_guard_update/delete`) jen pro demo.
  - Poznámka: úkol bez třídy i skupiny je čitelný všem přihlášeným. Teď takový publikovaný úkol neexistuje (0), ale návrh s tím počítá.
- Co z toho dědí (podmínka přes `EXISTS (SELECT … FROM assignments)` pod RLS):
  - `assignment_comments.ac_select`/`ac_insert` – Zeď a komentáře.
  - Žákovské stránky `StudentSubjectClass`, `StudentAssignments`, `StudentAssignmentPlayer` (přímý odkaz), `StudentCalendar`, `TodayWidget`, `StudentProgressWidgets`, rodičovské widgety – všechny čtou `assignments` klientem, tedy pod RLS.
- Co RLS **nedědí** (běží jako služba / SECURITY DEFINER, příjemce počítá samo):
  - DB funkce `notify_on_assignment_published`, `notify_deadline_soon` (třída přes `class_members`, nově skupina přes `subject_group_members`).
  - Edge funkce `notify-email`, `auto-reminders-job`, `publish-scheduled-assignments`, `notify-parent`, `detect-student-alerts`, `mcp`.
- Učitelská strana: `TeacherSubjectClass` počítá „Odevzdáno x/y" a přehled hodnocení z celého seznamu členů (`class_members` / `subject_group_members`, ř. 349, 444–462, 801–803, 1768). Stejně tak `TeacherResults`, `TeacherClassDetail`, `ClassWall`.
- Odevzdání: `assignment_attempts` – vložení povoleno, když `student_id = auth.uid()` (viditelnost úkolu se nekontroluje). Žák by tedy teoreticky mohl vložit pokus k cizímu ID; dnes to platí i pro úkoly jiných tříd.
- Messenger: tlačítko „Zeptat se učitele" bere jen název úkolu, který žák už vidí – nové riziko nevzniká.

## 2. Návrh UX

- Editor úkolu/materiálu/oznámení: pole „Pro koho" – přepínač **Celá třída/skupina | Vybraní žáci**.
  - U „Vybraní žáci" seznam žáků třídy/skupiny (bez preview žáků), hledání, „Vybrat vše" / „Nikdo", počítadlo „Vybráno N z M". Řádky i zaškrtávátka ≥44 px, na 390 px bez vodorovného posunu.
  - Zveřejnit nejde s 0 vybranými (srozumitelná chyba).
- Učitel: štítek „Jen vybraní žáci (N)" na kartě, Zdi a v přehledu; „Odevzdáno x/y" a hodnocení počítají jen z vybraných.
- Žák: vidí jen úkoly, které mu byly zadány – nikde jinde se neobjeví.
- Po zveřejnění: výběr lze měnit. Přidaný žák úkol uvidí a dostane upozornění jen on. Odebraný žák úkol přestane vidět, jeho odevzdaná práce a hodnocení zůstanou v DB a učitel je dál vidí (označí se „už není mezi příjemci").
- Žák odebraný z třídy úkol nevidí (jako dnes). Nový člen třídy úkol „pro vybrané" nedostane automaticky.

## 3. Návrh dat (SQL jen jako NÁVRH, nespouštět)

Varianta `settings.studentIds` (bez tabulky) – bezpečná jen částečně: RLS by musela číst jsonb, upozornění a statistiky by musely jsonb parsovat a není index. **Doporučuji tabulku.**

```sql
CREATE TABLE public.assignment_recipients (
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid NOT NULL DEFAULT auth.uid(),
  PRIMARY KEY (assignment_id, student_id)
);
CREATE INDEX assignment_recipients_student_idx ON public.assignment_recipients(student_id);
GRANT SELECT, INSERT, DELETE ON public.assignment_recipients TO authenticated;
GRANT ALL ON public.assignment_recipients TO service_role;
ALTER TABLE public.assignment_recipients ENABLE ROW LEVEL SECURITY;

-- Pomocné funkce (SECURITY DEFINER, bez rekurze RLS)
CREATE FUNCTION public.assignment_is_targeted(_aid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM assignment_recipients WHERE assignment_id = _aid) $$;

CREATE FUNCTION public.can_see_targeted_assignment(_aid uuid, _uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT assignment_is_targeted(_aid)
    OR EXISTS (SELECT 1 FROM assignment_recipients r WHERE r.assignment_id = _aid AND r.student_id = _uid)
    OR EXISTS (SELECT 1 FROM assignment_recipients r JOIN parent_student_links p
               ON p.student_id = r.student_id WHERE r.assignment_id = _aid AND p.parent_id = _uid)
    OR EXISTS (SELECT 1 FROM assignments a WHERE a.id = _aid AND (a.teacher_id = _uid
               OR is_teaching_unit_collaborator(a.subject_id, a.class_id, a.group_id, _uid)))
    OR is_admin() $$;

-- Jen PŘIDANÁ RESTRICTIVE politika: neomezí nikoho, kdo nemá úkol „pro vybrané"
CREATE POLICY recipients_only ON public.assignments AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_see_targeted_assignment(id, auth.uid()));

-- Recipients: učitel úkolu spravuje, žák vidí jen svůj řádek
CREATE POLICY ar_select ON public.assignment_recipients FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_id AND a.teacher_id = auth.uid()) OR is_admin());
CREATE POLICY ar_write ON public.assignment_recipients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_id AND a.teacher_id = auth.uid())
    AND (EXISTS (SELECT 1 FROM assignments a JOIN class_members cm ON cm.class_id = a.class_id
                 WHERE a.id = assignment_id AND cm.user_id = student_id)
      OR EXISTS (SELECT 1 FROM assignments a JOIN subject_group_members m ON m.group_id = a.group_id
                 WHERE a.id = assignment_id AND m.student_id = student_id)));
CREATE POLICY ar_delete ON public.assignment_recipients FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_id AND a.teacher_id = auth.uid()));
CREATE POLICY demo_iso ON public.assignment_recipients AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT is_demo_user(auth.uid()) OR demo_can_see_assignment(assignment_id))
  WITH CHECK (NOT is_demo_user(auth.uid()) OR demo_can_see_assignment(assignment_id));

-- Pojistka odevzdání: pokus jen k úkolu, který žák smí vidět
CREATE POLICY attempts_recipients_only ON public.assignment_attempts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.can_see_targeted_assignment(assignment_id, auth.uid()));
```

ROLLBACK (návrh):
```sql
DROP POLICY IF EXISTS attempts_recipients_only ON public.assignment_attempts;
DROP POLICY IF EXISTS recipients_only ON public.assignments;
DROP TABLE IF EXISTS public.assignment_recipients;
DROP FUNCTION IF EXISTS public.can_see_targeted_assignment(uuid, uuid);
DROP FUNCTION IF EXISTS public.assignment_is_targeted(uuid);
```

Bezpečnost: protože Zeď, komentáře, kalendář, přímý odkaz `/student/ulohy/ID` i rodičovské widgety čtou `assignments` pod RLS, jedna RESTRICTIVE politika je zavře všechny najednou. Úkoly bez řádků v `assignment_recipients` (všechny dnešní) se chovají přesně jako teď. Výkon: politika volá helper na každý řádek – index na `assignment_id` (PK) to pokryje; ověřit EXPLAIN.

## 4. Upozornění a e-maily

- `notify_on_assignment_published`, `notify_deadline_soon`: pokud má úkol příjemce, cílit jen na `assignment_recipients` (průnik se členy třídy/skupiny, bez preview žáků); jinak beze změny. Zpětně se nic neposílá – mění se jen budoucí zveřejnění.
- Pořadí: příjemci se musí uložit **před** přepnutím na `published`, jinak by trigger upozornil celou třídu. Editor: uložit koncept → uložit příjemce → zveřejnit. Naplánované zveřejnění (`publish-scheduled-assignments`) tím je kryté.
- Přidání žáka po zveřejnění: upozornění jen pro nového (nový malý trigger na INSERT do `assignment_recipients`, když je úkol `published`).
- Edge funkce `auto-reminders-job`, `notify-parent`, `detect-student-alerts`, `mcp` filtrovat stejně (běží jako služba, RLS je nechrání).

## 5. Etapy, soubory, rizika, testy

- **Etapa 1 (DB, po „schvaluji"):** migrace výše + úprava obou notify funkcí (původní těla do rollbacku).
- **Etapa 2 (frontend):** výběr „Pro koho" v editoru (`TeacherAssignments` / dialog úkolu, `PublishWorksheetDialog`), čistá funkce `src/lib/assignment-recipients.ts` (efektivní seznam příjemců = členové ∩ vybraní, bez preview), štítek, „Odevzdáno x/y" a přehledy v `TeacherSubjectClass`, `TeacherResults`, `TeacherClassDetail`, `ClassWall`.
- **Etapa 3 (edge funkce):** filtrace v `auto-reminders-job`, `notify-parent`, `detect-student-alerts`, `mcp`.
- Rizika: upozornění celé třídě při špatném pořadí uložení; pomalejší RLS; učitelské statistiky ukazující nesprávné y; zapomenutá edge funkce pošle připomínku nevybranému žákovi.
- Testy: vitest pro `assignment-recipients.ts` (průnik, preview žáci, prázdný výběr = chyba, odebraný žák s odevzdáním). Po migraci jen SELECT kontroly `pg_policies` a čtecí simulace počtu příjemců – bez INSERTů na skutečných třídách, bez e-mailů.

## Na čem se rozhodnout

1. Tabulka `assignment_recipients` (doporučeno) nebo `settings.studentIds`?
2. Platí výběr i pro materiály a oznámení, nebo jen pro úkoly?
3. Mají rodiče vybraného žáka úkol vidět (návrh: ano, jen u svého dítěte)?
4. Odebraný žák s odevzdanou prací: úkol mu zmizí (návrh), nebo zůstane jen ke čtení?
5. Přidat i pojistku na odevzdání (`attempts_recipients_only`)?
6. Schvalujete SQL Etapy 1 („schvaluji")?
