# Úkoly s pracovním listem: detail karty a „Úloha N“

Jen analýza. Kód, DB, AGENTS.md beze změny, nic nenasazeno.

## Co je ověřeno

**(a) Klik na kartu.** V `TeacherAssignments.tsx` je `onClick={() => setDetailAssignment(a)}` na celé kartě (ř. ~2048), tlačítko „Detail“ (ř. ~2137) a otevření z adresy (ř. ~383). Dialog `AssignmentDetailDialog` se vykresluje na ř. ~2199. Kód tedy otevření obsahuje; v logu náhledu není zachycená chyba. **Příčina zatím nepotvrzena** – kandidáti: vnořené prvky volající `stopPropagation`/vlastní akci, chyba při načítání v dialogu (`throw error` u `assignment_attempts`, ř. ~381) nebo rozbití vykreslení nad listem se „starými“ položkami. Prvním krokem opravy je reprodukce v přihlášeném náhledu jako admin.

**(b)+(c) Text otázky.** Dotaz na všechny listy (jen struktura, bez odpovědí žáků):

| typ | položek | prázdný `prompt` | kde je text |
|---|---|---|---|
| mcq, true_false, short_answer, open_answer, matching, ordering, fill_blank, sorting, image_label | vše | 0 | `prompt` |
| write_lines | 1250 | 330 | v předchozím `section_header` / `instruction_box` |
| blank_box | 410 | 350 | předchozí nadpis/pokyn |
| table | 241 | 241 | `tableCaption`, příp. předchozí nadpis |
| two_boxes | 384 | 216 | `leftTitle` / `rightTitle` |
| callout, image, image_text, gallery | | | `calloutText`, `imageCaption`/`imageAlt`, `imageText` (rozvržení) |

Týká se starších i nových listů (září až listopad 2026), nejen nového editoru. Typy `mind_map` a aktivity ze sjednoceného editoru se v datech listů zatím nevyskytují; z kódu převzít jejich titulek (`mindMap.root`, `activitySpec.question/title`).

**(d) Kde je stejný fallback:** `WorksheetAttemptGrading.tsx:171` (hodnocení pokusu), `TeacherResults.tsx:318` (výsledky a export z této tabulky), `AssignmentDifficultyStats.tsx:272` (statistiky). Žákovský `WorksheetPlayer.tsx:678` používá „Úloha N“ jen jako aria-label navigace a nemění se.

## Návrh minimální opravy (jen frontend)

1. Reprodukovat klik na kartu (admin, úkol s listem), zachytit konzoli; opravit konkrétní příčinu (např. odolné načtení v dialogu místo `throw`, nebo správné šíření kliku).
2. Nový čistý pomocník `src/lib/worksheet-item-label.ts`: `worksheetItemLabel(item, precedingItems)` v pořadí `prompt` → typové pole (`tableCaption`, `leftTitle`, `calloutText`, `imageCaption`, `imageAlt`, `mindMap.root`, `activitySpec.question`) → text nejbližšího předchozího `section_header`/`instruction_box` → „Úloha N“. Odstraní HTML/markdown a zkrátí.
3. Použít ho na všech třech místech; data ani hodnocení se nemění.

## Testy

- `worksheet-item-label.test.ts`: každý typ z tabulky, prázdný prompt s předchozím nadpisem, fallback „Úloha N“, ořezání HTML.
- Test karty úkolu: klik na tělo otevře detail, klik na akční tlačítka ne.
- Ruční průchod: detail, hodnocení, výsledky a statistiky u úkolu se starým listem.

## Rizika

Předchozí nadpis může patřit k více úlohám (stejný popisek) – doplnit „(úloha N)“. Soubory: `TeacherAssignments.tsx`, `AssignmentDetailDialog.tsx`, `WorksheetAttemptGrading.tsx`, `TeacherResults.tsx`, `AssignmentDifficultyStats.tsx`, nový pomocník a testy.
