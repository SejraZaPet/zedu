# Pracovní listy „jen k dispozici“ vs. „k odevzdání“

Zatím jen analýza. Kód ani data se nemění, nic se nenasazuje, `AGENTS.md` beze změny.

## 1. Kde list vzniká jako materiál a kde jako úkol

| Místo | Výsledek |
|---|---|
| `TeacherAssignments.tsx`, druh „Materiál“ (`materialWorksheets`, `settings.kind="material"` + `settings.worksheets`) | jen k dispozici |
| Plán hodiny, `PlanWorksheetsSection` / `plan-worksheets.ts` (`worksheet_ids`), žák přes `lesson-plan-student.ts` | k dispozici, otevře se ve `StudentWorksheetView` |
| `PublishWorksheetDialog.tsx` ř. ~137–149, „Zadat třídě“ | **vždy úkol**: insert bez `settings.kind`, a chybějící druh = úkol (`assignment-kind.ts`) |
| `PublishWorksheetDialog.tsx` ř. ~95–113, připojení k existujícímu | zachová druh cíle |
| `TeacherAssignments.tsx`, druh „Úkol“ s listem | úkol |

**Hlavní příčina:** dialog „Publikovat list“ nenabízí volbu druhu, takže každé zadání třídě odtud je úkol k odevzdání.

## 2. Co žák zažije

- **Materiál:** `StudentAssignmentPlayer.tsx` ř. ~232 a 752 ukazuje `MaterialWorksheetsCard`, který je jen pro čtení (bez pokusu, bez odevzdání). Na ř. 943 se přehrávač úkolu přeskočí. `submittableOnly` vynechá materiál z výsledků, z „chybí odevzdat“, z hodnocení i z termínů. Výchozí e-mail je u materiálu podle druhu, upomínky po termínu se neposílají.
- **Plán hodiny a lekce:** `WorksheetPanel` a `StudentWorksheetView` předají `work`, takže žák může vyplňovat a **odevzdat vlastní práci** do `student_worksheet_work` (`useWorksheetAutosave.ts` ř. ~213, `worksheet-work.ts` ř. 80). Nevzniká `assignment_attempts`, neobjeví se v hodnocení, statistikách, termínech ani upozorněních. Tlačítko „Odevzdat“ je však vidět, a to může mást.
- **Úkol:** vzniká `assignment_attempts`; úkol se objeví v hodnocení, v „nesplněno“, v termínech, v upozorněních i v e-mailech.

## 3. Existující úkoly, které měly být materiálem

Data (souhrn, bez jmen):
- Zveřejněné položky s listem: 25 úkolů a 3 materiály.
- 10 úkolů nemá termín.
- 4 úkoly nemají žádné odevzdání. To jsou nejpravděpodobnější kandidáti.

**Převod:** stačí `settings.kind = "material"` + `settings.worksheets = [{id: worksheet_id}]` přes `buildKindSettings` / `neutralizeForKind`. Pokusy, body a komentáře v DB zůstanou, jen se přestanou zobrazovat ve výsledcích a v „chybí“ (`submittableOnly`). Převod lze vrátit zpět. U úkolů, které už mají odevzdání nebo hodnocení, převod buď zakázat, nebo vyžadovat výslovné potvrzení („odevzdání se skryjí z výsledků, nesmažou se“).

## 4. Nejmenší bezpečná změna (jen frontend)

- a) `PublishWorksheetDialog`: přepínač **„Jen k dispozici (bez odevzdání)“ / „K odevzdání“**. Výchozí „Jen k dispozici“ podle Tyny; termín a body jen u úkolu. Zápis přes `buildKindSettings` (kind material + worksheets).
- b) `TeacherAssignments`: hromadná akce **„Změnit na materiál“** u vybraných úkolů. Owner-scoped update `settings` a neutralizace polí úkolu; úkoly s odevzdáním vyžadují potvrzení. Stejná volba i v detailu úkolu.
- c) Režim „jen k dispozici“: `MaterialWorksheetsCard` zůstává jen pro čtení, s tlačítky Otevřít a Tisk/PDF (stávající tisk listu). Plán hodiny a lekce mohou volitelně skrýt „Odevzdat“ vlastní práce, ale drafty zachovat (učitelská volba později, mimo minimum).
- d) Žák: štítek **„K dispozici – neodevzdává se“** na kartě i v detailu (`StudentAssignments.tsx` ř. ~120, `StudentAssignmentPlayer`). Text tykáním.

## 5. RLS/DB, testy, rizika

- **DB/RLS beze změny:** druh je v `settings` (JSON), materiál čtou žáci podle existujících pravidel členství a příjemců. Hromadný převod jde přes běžný update vlastníka.
- **Testy:**
  - Dialog bez úkolu vloží `kind: material` a s úkolem ne.
  - Hromadný převod nastaví kind/worksheets a zachová ostatní `settings`.
  - Materiál vypadne ze `submittableOnly`.
  - Žákovský štítek.
  - Úkol s odevzdáním vyžaduje potvrzení.
- **Rizika:**
  - Skrytí existujících známek po převodu (proto potvrzení).
  - E-mail o novém úkolu už mohl odejít.
  - Změna výchozí volby v dialogu může překvapit učitele, kteří chtějí úkol, proto jasný popisek.

## Souvislost s ostatními hlášeními

- „Úloha N“ (opraveno v `d72dd319`) a toto hlášení mají společný původ: listy přiložené jako zápisové stránky (nadpis + prázdný rámeček), které dialog zveřejnil jako úkol, a proto se objevily v hodnocení.
- Otevírání detailu z karty v náhledu funguje. Pokud selhává na webu, jde spíš o starší nasazenou verzi, ne o tutéž příčinu.
