## Cíl
Dorovnat nabídku pracovního listu s interaktivními aktivitami z lekcí. Přidat (a) nový blok "Obsah z lekce" jako referenci a (b) tisknutelné varianty aktivit jako nové typy úloh.

## A) Lesson reference blok
Nový `ItemType: "lesson_reference"` — uloží `lessonId` + `blockId` (nebo více blockIds). V editoru se vykreslí jako náhled obsahu lekce (řešitelný přes existující `LessonContentPickerSheet`). V PDF/printu se vyrenderuje jako textová/obrazová pasáž (read-only kontext k navazujícím otázkám).

## B) Nové typy úloh (paper-friendly)
| Typ | Popis na papíře |
|---|---|
| `crossword` | Vygenerovaná křížovka (mřížka + nápovědy vodorovně/svisle) |
| `word_search` | Osmisměrka s tajenkou |
| `sorting` | Tabulka s 2–4 kategoriemi a seznamem položek k zařazení |
| `flashcards` | Mřížka kartiček k vystřižení (otázka / odpověď) |
| `image_label` | Obrázek s číslovanými popisky + tabulka pro doplnění |
| `image_hotspot` | Obrázek s vyznačenými body + otázky k bodům |

Každý typ dostane:
- defaultní data v `worksheet-defaults.ts`
- label v `ITEM_TYPE_LABELS`
- renderer v `src/components/worksheet-items/` registered v `index.ts`
- print renderer větev ve `worksheet-print-renderer.ts`
- AI prompt větev v `generate-full-worksheet`

## Technické změny
1. **`src/lib/worksheet-spec.ts`**: rozšířit `ItemType` union + přidat volitelná pole (`crosswordGrid`, `crosswordClues`, `wordSearchGrid`, `wordSearchWords`, `sortingCategories`, `sortingItems`, `flashcards`, `imageUrl`, `imageLabels`, `imageHotspots`, `lessonRefBlockIds`).
2. **`src/lib/worksheet-defaults.ts`**: defaults + labels pro 7 nových typů.
3. **`src/components/worksheet-items/`**: 7 nových rendererů + registrace v `index.ts`.
4. **`src/lib/worksheet-print-renderer.ts`** + `src/lib/worksheet-pdf-export.ts`: tisk větve.
5. **`src/pages/WorksheetEditor.tsx`**: typové ikony, editace per typ (využít existující dialog patterns), volání lessonPickeru pro `lesson_reference`.
6. **`supabase/functions/generate-full-worksheet/index.ts`**: rozšířit tool schema o nové typy.

## Co se neřeší
- Crossword/wordsearch generátor: jednoduchý greedy fill na FE (reuse `src/lib/crossword-engine.ts` pokud lze).
- Žádné DB schema změny (`spec` je JSONB).
- Backend AI generátor jednotlivých nových typů (button "Zeptej se AI" u nich) — pouze full-worksheet AI je doplněno; per-block AI v další iteraci.

## Rozsah jednoho deliverable
~10 nových souborů, ~5 editací. Bez DB migrace.
