## Rozsah

Vylepšení UX editoru pracovních listů (`src/pages/WorksheetEditor.tsx`, ~2940 řádků) ve 4 oblastech. Návrh — než začnu sahat do souboru, potvrď prosím rozsah.

## ZMĚNA 1 — Náhled přiřazené lekce v hlavním sloupci

- Pod hlavičkou (předmět/ročník) přidám `Collapsible` „Náhled přiřazené lekce" (default zavřený).
- Zdroj obsahu: pokud existuje `sourceLessonId`, načtu `blocks` z `textbook_lessons` / `teacher_textbook_lessons` (logiku už používáme jinde — rozšířím existující efekt o uložení `lessonBlocks` v plné podobě, ne jen text).
- Render: jednoduchý `BlockPreview` (nadpis + odstavce + obrázky read-only), max-h 400, scroll. Když lekce není, hlášku „Žádná lekce není přiřazena".

## ZMĚNA 2 — AI a šablony pracují s obsahem lekce

A) Frontend: do volání edge funkcí přidám `lessonContent` (text) a `lessonTitle`. Konkrétně:
   - `openSuggestionsForBlock` (už posílá text bloku — sjednotím)
   - `generate-mcq`, `generate-matching`, `generate-items`, `worksheet-block-refine`
B) Edge functions: doplním system prompt o instrukci „Generuj VÝHRADNĚ z obsahu přiřazené lekce…" a vložím `lessonContent` (zkrácený na ~6 000 znaků kvůli tokenům). Upravím:
   - `supabase/functions/generate-mcq/index.ts`
   - `supabase/functions/generate-matching/index.ts`
   - `supabase/functions/generate-items/index.ts`
   - `supabase/functions/generate-worksheet/index.ts` (volitelně)
C) Šablony: po výběru šablony otevřu dialog „Vyplnit z obsahu lekce?".
   - Pokud Ano → nová edge funkce `fill-template-from-lesson` (Gemini Flash) která dostane `templateId`, prázdné bloky šablony a `lessonContent`, vrátí předvyplněné `WorksheetItem[]`.
   - Pokud Ne → stávající `buildTemplate` (žádná změna chování).

## ZMĚNA 3 + 4 — Inline editace v hlavním sloupci, sbalené/rozbalené bloky

Toto je největší úprava. Plán:

- Stávající pravý panel „VLASTNOSTI" (cca ř. 1294–1317, 1723–1726) **odstraním** z desktopu. Mobilní `Sheet` (PanelRight) **také odstraním** (už nebude potřeba, edituje se inline).
- Nahradím komponentu `SortableItemBlock` novou, která má dva režimy:
  - **collapsed** (default): kompaktní řádek — grip, číslo, label typu, prompt (truncate), body, delete (hover).
  - **expanded**: rámeček `border-2 border-primary`, akce (nahoru/dolů/hotovo/smazat), `Textarea` na prompt, type-specific editor (přesunutý z `PropertiesPanel` — MCQ choices, matching pairs, fill-blank, ordering, true/false, short/open answer, layoutové bloky, offline), spodní řádek body+obtížnost+čas.
- Type-specific editory vytáhnu z `PropertiesPanel` do samostatné funkce `renderTypeSpecificEditor(item, onUpdate, answerKey, onUpdateKey)` aby byly použitelné v obou kontextech. `PropertiesPanel` zatím nesmažu — využiji jej jako zdroj logiky a poté odstraním.
- Lokální state `expandedId` v hlavní komponentě nahradí `selectedId` (zachovám jméno pro minimum diff; sémantika „kliknutím rozbalím, „Hotovo" sbalím").
- `AiBlockChat` přesunu dovnitř rozbaleného bloku (pod editor, nad spodní řádek).
- DnD: grip handle zůstane v collapsed i expanded variantě.
- Pole „body / obtížnost / čas" budou v collapsed jen jako badge text vpravo, v expanded jako editor.

## Bezpečnostní zábrany

- Ukládání, autosave, PDF export, šablony, propojení lekcí (`worksheet_lessons`) — žádné zásahy do logiky.
- `WorksheetItem` typ neměním.
- Nová edge funkce pro šablony bude `verify_jwt = true` (default), volá ji autenticated učitel.

## Soubory, kterých se to dotkne

- `src/pages/WorksheetEditor.tsx` — hlavní refaktor (Změna 1, 3, 4) + napojení Změny 2.
- `supabase/functions/generate-mcq/index.ts`
- `supabase/functions/generate-matching/index.ts`
- `supabase/functions/generate-items/index.ts`
- `supabase/functions/worksheet-block-refine/index.ts`
- **NOVÁ** `supabase/functions/fill-template-from-lesson/index.ts` (Změna 2C)

## Otázka na potvrzení

Provést všechny 4 změny v jednom kole, nebo rozdělit? Tip: je rozumné odbavit nejdřív **Změnu 1 + 3 + 4** (čistě frontend, rychlá vizuální odezva, žádná závislost na edge funkcích), a **Změnu 2 (AI s kontextem lekce + Vyplnit šablonu z lekce)** udělat ve druhém kroku — méně riziková regrese AI promptů.

Vyber prosím:
1. **Vše v jednom kole (1+2+3+4)** — větší zásah, delší cyklus, riziko regresí AI.
2. **Nejdřív 1+3+4 (frontend)**, pak 2 v dalším promptu — doporučeno.
3. **Jen 3+4 (inline editace)** — největší UX win, zbytek později.
