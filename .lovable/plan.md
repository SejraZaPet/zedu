# Hodnocení pracovního listu: „1. Úloha 2“ místo zadání

Jen analýza a návrh. Nic se nenasazuje, data se nemění, `AGENTS.md` beze změny.

## Příčina (ověřeno v datech, bez odpovědí žáků)

List úkolu „Slovenská gastronomie – praktický úkol nebo test“ střídá nadpisy a prázdná pole:

| č. | typ | text |
|---|---|---|
| 1 | section_header | „Název pokrmu:“ |
| 2 | blank_box | prázdný `prompt` |
| 3 | section_header | „Suroviny:“ |
| 4 | blank_box | prázdný `prompt` |
| 5 | section_header | „Postup:“ |
| 6 | blank_box | prázdný `prompt` |
| 7–8 | section_header „Sebereflexe“ + blank_box „Jak se mi vedlo“ | |

Obě položky ze snímku jsou tedy `blank_box` (volný rámeček na odpověď, ne open_answer ani offline_activity). Zadání je v **předchozím nadpisu** (`section_header.prompt`), ne v samotné položce. Stejný vzor mají i listy „teorie“ a „materiály“ (blank_box a table s prázdným promptem).

Zdvojené číslo: `WorksheetAttemptGrading.tsx` ř. 280 vypisuje `{i + 1}. {r.prompt}` a prompt obsahoval `Úloha ${itemNumber}`, proto vznikne „1. Úloha 2“.

Stav: commit `3d81534c` už přidal `worksheetItemLabel` (prompt → typové pole → předchozí nadpis). U tohoto listu by teď zobrazil „Název pokrmu: (úloha 2)“, takže čísla jsou stále dvě.

## Detail z karty v Úkolech

Ověřeno v přihlášeném náhledu: klik na kartu úkolu s listem otevře needitovatelný detail se zadáním a odevzdáním. Pokud učitelka chybu vidí na veřejném webu, jde pravděpodobně o starší nasazenou verzi; potřebujeme název úkolu, u kterého se detail neotevře.

## Návrh opravy (jen frontend)

1. `worksheet-item-label.ts`: vracet `{ text, source }` bez připojeného „(úloha N)“; odstranit koncovou dvojtečku z nadpisu („Název pokrmu“), zkrátit na ~120 znaků s „…“ a plný text dát do `title`.
2. Když zadání chybí: srozumitelný název typu místo „Úloha N“, např. blank_box „Volná odpověď“, write_lines „Odpověď na řádky“, table „Tabulka“, two_boxes „Dva rámečky“, open_answer „Otevřená odpověď“, image_label „Popis obrázku“ apod. (mapa v jednom místě).
3. Číslování jen jedno: v hodnocení ponechat pořadí `i + 1.` a ve štítku žádné číslo; ve výsledcích a statistikách (bez pořadového čísla) přidat jen „č. N“ při shodných popiscích, aby šly odlišit.
4. Použít ve všech třech místech (hodnocení, výsledky, statistika obtížnosti).

## Testy

- Vzor nadpis + blank_box → „Název pokrmu“, bez čísla.
- Prázdný blank_box bez nadpisu → „Volná odpověď“.
- Žádný popisek neobsahuje „Úloha“ s číslem; hodnocení vykreslí „1. Název pokrmu“.
- Ruční kontrola detailu odevzdání tohoto úkolu v náhledu.

## Soubory

`src/lib/worksheet-item-label.ts` (+ test), `src/components/admin/WorksheetAttemptGrading.tsx`, `src/pages/TeacherResults.tsx`, `src/components/admin/AssignmentDifficultyStats.tsx`.
