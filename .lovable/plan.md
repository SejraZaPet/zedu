# Úkoly: Odevzdané / Po termínu / Ke kontrole / Lze odevzdat po termínu

## Souhrn pro učitelku
- **Proč žák vidí „Po termínu“:** Odevzdaný úkol se mezi „Po termínu“ nedostane. Pořadí kontrol to nedovolí: odevzdání se kontroluje dřív než termín. V databázi ale je **206 rozpracovaných pokusů** po termínu, které žáci nikdy neodevzdali tlačítkem „Odevzdat“. Pravděpodobně si myslí, že je práce uložená, a tedy odevzdaná. Po termínu žádné odevzdání zatím není (0). Aplikace ho dnes neumožní, ovšem jen v prohlížeči.
- **Fáze 1 (bez databáze):** nové kategorie pro žáka i učitele, štítky „Odevzdáno po termínu“ a „Odevzdalo 18/24“ s barvou a vždy s textem. Rozpracovaná, ale neodevzdaná práce dostane štítek „Rozpracováno – neodevzdáno“.
- **Fáze 2 (malá změna databáze, jen se schválením):** volba „Lze odevzdat po termínu“. Uloží se do stávajícího nastavení úkolu, bez nového sloupce. Pravidlo navíc ohlídá databáze. Stávající úkoly se budou chovat jako dnes, tedy po termínu odevzdat nepůjde.
- Testovací žák ani demo uživatelé se do počtů „Odevzdalo X/Y“ nezapočítají.

## 1. Jak to funguje dnes
- Stavy počítá jedno místo: `src/lib/assignment-status.ts` (`assignmentStatus`). Pořadí: připravuje se → vše ohodnoceno („Ohodnoceno“) → vše odevzdáno („Čeká na hodnocení“) → termín minul („Po termínu“) → do 24 h („Končí dnes/zítra“) → „K odevzdání“.
- Skupiny `ASSIGNMENT_GROUPS`: K odevzdání, Odevzdáno, Po termínu, Ohodnoceno, Připravuje se. Zobrazuje je `AssignmentStatusGroups.tsx`. Stav sbalení skupin platí jen pro aktuální relaci.
- Žák: `StudentAssignments.tsx` (Moje úlohy), `TodayWidget.tsx`, `StudentSubjectClass.tsx`. Pokusy načítá `student-assignment-attempts.ts`, včetně skupinových. Kalendář žáka úkoly podle stavu netřídí.
- Učitel: `TeacherAssignments.tsx` a `TeacherSubjectClass.tsx` počítají `assignmentClassProgress`, tj. odevzdáno/ohodnoceno/celkem. Členy čtou z `class_members.user_id` nebo `subject_group_members.student_id`. U sdílených skupin úkolu používají `assignment_group_members`.
- Pro učitele je dnes úkol „Po termínu“, dokud neodevzdají všichni. Kategorie „Ke kontrole“ chybí.
- Data:
  - `assignments`: termín je `deadline`, dále `settings jsonb`, `max_attempts`, `status`, `exam_type`, `group_mode`. Nastavení „allow_late“ neexistuje.
  - `assignment_attempts`: `status` (in_progress/submitted), `submitted_at`, `score` (null = neohodnoceno), `max_score`, `teacher_feedback_at`. Sloupec typu needs_review neexistuje. Otevřené otázky se dnes poznají podle `score = null`.
- Termín hlídá jen prohlížeč: `StudentAssignmentPlayer.tsx` ř. 208–290 (toast „Termín vypršel“, po termínu jen prohlížení). Pravidla přístupu v databázi termín nekontrolují. Žák by technicky mohl rozpracovaný pokus odevzdat i po termínu.
- Při odevzdání běží tyto automatické akce: XP (`add_xp`), upozornění učiteli, rodičům a portfolio. Fáze 1 je nemění.

## 2. Kdo se počítá do „odevzdalo“
- Testovací žák je skrytý v `class_members`, `subject_group_members` a `profiles` (I2a). Učitel ho tedy v počtu nedostane.
- Demo účty vidí jen data svého páru, takže skuteční učitelé je nevidí.
- Navíc se na klientu použije `excludePreviewStudents`, pro jistotu.

## 3. Nové stavy (fáze 1)
Žák (vždy text, barva jen doplňuje):
| Kategorie | Pravidlo | Štítek |
|---|---|---|
| Čeká | neodevzdáno, termín neminul | „K odevzdání“ / „Končí dnes/zítra“ |
| Odevzdané | odevzdáno, bez bodů | „Odevzdáno“, při `submitted_at > deadline` navíc „Odevzdáno po termínu“ (oranžový) |
| Zkontrolované | odevzdáno a `score` není null | „18 / 24 b.“ (+ případně „Odevzdáno po termínu“) |
| Po termínu | termín minul a nic není odevzdáno | „Neodevzdáno“, a pokud existuje rozpracovaný pokus, „Rozpracováno – neodevzdáno“ |

Učitel:
| Kategorie | Pravidlo |
|---|---|
| Připravuje se | beze změny |
| Probíhá | termín neminul a nic ke kontrole |
| Ke kontrole | aspoň jedno odevzdání bez bodů |
| Zkontrolované | všechna odevzdání mají body a termín minul, nebo odevzdali všichni |
| Uzavřené | termín minul a nikdo neodevzdal (nic ke kontrole) |

Štítek „Odevzdalo X/Y“: zelená = všichni, oranžová = část, šedá = nikdo, červená = nikdo a termín minul. Barvy se vezmou z tokenů v `index.css` (kontrast AA) a přidá se ikona.

## 4. Fáze 2: „Lze odevzdat po termínu“
- Uložení: `assignments.settings.allowLate` (true/false), bez nového sloupce. Chybějící hodnota znamená false, takže stávající úkoly fungují jako dnes.
- Kde se nastavuje: zaškrtávátko ve formuláři úkolu v `TeacherAssignments.tsx` (vytvoření i úprava).
- Prohlížeč: když je `allowLate` zapnuté, přehrávač po termínu dovolí pokračovat a odevzdat a ukáže upozornění „Odevzdáváš po termínu“. Když je vypnuté, zůstane dnešní chování: jen prohlížení a hláška „Termín vypršel, úkol už nelze odevzdat.“
- Server (návrh, NESPOUŠTĚT): trigger, který odmítne odevzdání po termínu, pokud ho úkol nepovoluje.
```sql
CREATE OR REPLACE FUNCTION public.enforce_assignment_deadline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d timestamptz; allow boolean;
BEGIN
  IF NEW.status <> 'submitted' OR (TG_OP = 'UPDATE' AND OLD.status = 'submitted') THEN RETURN NEW; END IF;
  IF public.is_admin() OR public.is_admin_or_teacher(auth.uid()) THEN RETURN NEW; END IF;
  SELECT deadline, coalesce((settings->>'allowLate')::boolean, false) INTO d, allow
    FROM public.assignments WHERE id = NEW.assignment_id;
  IF d IS NOT NULL AND now() > d + interval '2 minutes' AND NOT allow THEN
    RAISE EXCEPTION 'deadline_passed' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_assignment_deadline() FROM PUBLIC, anon;
CREATE TRIGGER trg_enforce_assignment_deadline
  BEFORE INSERT OR UPDATE OF status ON public.assignment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_assignment_deadline();
```
Tolerance 2 minuty pokrývá odevzdání odeslané těsně před koncem. Před spuštěním se ověří přesná signatura `is_admin_or_teacher`.
Rollback:
```sql
DROP TRIGGER IF EXISTS trg_enforce_assignment_deadline ON public.assignment_attempts;
DROP FUNCTION IF EXISTS public.enforce_assignment_deadline();
```
- Riziko: dnes po termínu nikdo neodevzdává (0 záznamů), takže trigger nikoho neomezí. Po dobu tolerance se ale ještě ověří automatické odevzdání při vypršení časovače.

## 5. Rozsah, rizika, testy
- Fáze 1: `assignment-status.ts` (nové stavy a `submittedLate`), `AssignmentStatusGroups.tsx` (štítky), `StudentAssignments.tsx`, `TodayWidget.tsx`, `StudentSubjectClass.tsx`, `TeacherAssignments.tsx`, `TeacherSubjectClass.tsx` (předat `submitted_at` a `deadline`). Načítání pokusů doplní `submitted_at`.
- Beze změny zůstanou: notifikace, auto-připomínky, XP/liga, portfolio, rodičovský pohled a kalendář (nepoužívají `assignment-status`). Plánované úkoly (`settings.plan`) mají vlastní větev, ta se ověří testem.
- Riziko: uložený stav sbalení skupin pod starými klíči. Nové klíče skupin se prostě zobrazí rozbalené.
- Testy (`src/test/assignment-status*.test.ts`): odevzdáno po termínu ≠ „Po termínu“; rozpracováno po termínu = „Po termínu“ se štítkem „Rozpracováno – neodevzdáno“; score 0 = zkontrolováno; učitel „Ke kontrole“ při 1 neohodnoceném; „Odevzdalo 18/24“ a barva; testovací žák se do Y nepočítá; `allowLate` chybí = false.
- Kroky: Fáze 1 (jen kód, testy, ověření v prohlížeči jako žák a učitel) → schválení „schvaluji fázi 2“ → trigger + zaškrtávátko + přehrávač → testy. Nic se nenasadí bez pokynu „nasadit“.

## Otázky
1. Má se rozpracovaná, ale neodevzdaná práce po termínu zobrazit jako „Po termínu“ se štítkem „Rozpracováno – neodevzdáno“ (návrh), nebo ji chcete brát jako odevzdanou?
2. Má mít „Lze odevzdat po termínu“ i konečné datum (např. +7 dní), nebo stačí ano/ne?
