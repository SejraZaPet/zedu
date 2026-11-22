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

## 3. Historické úkoly, které měly být materiály

Učitelka je zadala jako úkoly, protože sekce Materiály tehdy ještě neexistovala.

**Jak je poznat:**
- druh úkol (`settings.kind` chybí nebo je `task`),
- mají `worksheet_id`,
- jsou zveřejněné a patří přihlášenému učiteli.

Učitel je rozhoduje sám; nic se nepřevádí automaticky.

**Počty z dat (všichni učitelé, 17. 9. – 9. 11. 2026):**
- 25 zveřejněných úkolů s listem,
- 10 bez termínu,
- 4 bez odevzdání,
- 21 s odevzdáními,
- 15 s body nebo komentářem,
- 0 bez termínu a zároveň bez odevzdání.

Většina tedy už nějaká odevzdání má. Výběr proto musí ukazovat dopad u každého úkolu zvlášť.

**Výpis k výběru** (nová záložka/filtr „Úkoly s listem“ v Úkolech, owner-scoped čtení). U každého úkolu:
- název,
- třída/skupina,
- datum,
- termín,
- počet odevzdání,
- počet hodnocených.

Dotaz pro konkrétní učitelku spustíme až po schválení:

```sql
select a.id, a.title, a.created_at, a.deadline,
  count(x.id) filter (where x.status in ('submitted','graded')) odevzdano,
  count(x.id) filter (where x.score is not null or x.teacher_feedback_text is not null) hodnoceno
from assignments a left join assignment_attempts x on x.assignment_id = a.id
where a.teacher_id = '<id učitelky>' and a.worksheet_id is not null
  and coalesce(a.settings->>'kind','task') = 'task' and a.status = 'published'
group by a.id order by a.created_at;
```

**Hromadná akce „Změnit na materiál“:** vybrat více úkolů → náhled dopadu (souhrn „X odevzdání, Y hodnocení se skryje z výsledků, nic se nesmaže“) → potvrzení.

| Co | Co se stane |
|---|---|
| Termín | Uloží se do `settings.previousTask` (deadline, lateUntil, notifyOverdue) a sloupec `deadline` se vynuluje přes `neutralizeForKind`. Žádné „po termínu“. |
| Odevzdání a známky | Řádky `assignment_attempts` zůstanou beze změny. Zmizí z výsledků, z „nesplněno“ a z fronty hodnocení (`submittableOnly`). |
| Upozornění a e-maily | Při převodu se nic nového neposílá. Upomínky po termínu přestanou (jen úkoly). Odeslané e-maily nejdou vrátit. |
| Statistiky „nesplněno“ | Materiál se nepočítá. |
| Žák | Položka se přesune z Úkolů do Materiálů se štítkem „K dispozici – neodevzdává se“. List se otevře jen pro čtení s tiskem a PDF. Dřívější odevzdání se žákovi dál zobrazí jako historie. |

**Vrácení zpět (materiál → úkol):** stejná akce opačným směrem. Obnoví termín ze `settings.previousTask`, odstraní `kind: material`, a `worksheet_id` doplní z `settings.worksheets[0]`. Pokusy a známky se znovu objeví, protože se nikdy nemazaly. Při vrácení se neposílá e-mail „nový úkol“.

**Stačí změna `settings`?** Ano. Druh, termín i záloha jsou v `assignments.settings` a ve stávajících sloupcích. Zápis je běžný update vlastníka, který dnešní pravidla přístupu dovolují. DB ani RLS se nemění. Ověřit je potřeba dvě věci:
- že triggery na `assignments` při změně druhu neposílají oznámení,
- že žákovské čtení materiálu jde přes stejné členství a příjemce jako u úkolu.

Obojí jen kontrolou, bez zápisu.

**Testy:**
- převod zachová ostatní `settings` a uloží `previousTask`,
- vrácení obnoví termín i `worksheet_id`,
- materiál vypadne ze `submittableOnly`, a po vrácení se tam znovu objeví,
- převod nemaže pokusy (mock: žádné delete),
- náhled dopadu ukáže správné počty,
- přihlášený průchod: převod → žák vidí materiál → vrácení → hodnocení zůstalo.

## 4. Nejmenší bezpečná změna (jen frontend)

- a) `PublishWorksheetDialog`: přepínač **„Jen k dispozici (bez odevzdání)“ / „K odevzdání“**. Výchozí „Jen k dispozici“ podle Tyny; termín a body jen u úkolu. Zápis přes `buildKindSettings` (kind material + worksheets).
- b) Hromadná akce „Změnit na materiál“ a vrácení zpět podle bodu 3, stejná volba i v detailu úkolu.
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
