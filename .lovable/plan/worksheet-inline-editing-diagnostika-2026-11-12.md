# Úprava pracovního listu přímo v listu – diagnostika a návrh (etapa 1)

Pouze analýza. Žádný kód, migrace ani nasazení.

## 1. Jak se dnes upravuje učebnice
- `TeacherTextbookLessonEditorSheet.tsx` (ř. 368) → `BlockEditor` (`src/components/admin/BlockEditor.tsx`); každý blok má vlastní editor v `src/components/admin/block-editors/*`.
- Text píše `MiniRichEditor.tsx` (TipTap: StarterKit, podtržení, zarovnání, barvy, zvýraznění, horní/dolní index). Ukládá HTML do `block.props.text`.
- Úložiště: `teacher_textbook_lessons.blocks` (JSON pole `{id,type,visible,props,frame…}`, `src/lib/textbook-config.ts:44`). 26 typů bloků (`textbook-config.ts:15`).
- Ukládá se tlačítkem (`saveLessonEdit`, ř. 129), ne automaticky. Undo: historie pole bloků (max. 100) v BlockEditoru + vlastní historie TipTapu.
- Sanitizace jen při zobrazení (`LessonBlockRenderer` DOMPurify, `ArticleContent`).
- Znovupoužitelné: `MiniRichEditor` v režimu `bare` (lišta až při kliknutí). Lišta není samostatná komponenta.

## 2. Jak dnes funguje WorksheetEditor
- Soubor: `src/pages/WorksheetEditor.tsx`. Vlevo paleta, uprostřed stránky `.worksheet-a4-page`, vpravo nastavení listu.
- Každá položka = `SortableItemBlock` (ř. ~3610): vykreslí žákovskou komponentu z `ITEM_RENDERERS` (`worksheet-items/index.ts`) jako `disabled`, zadání jako `<span>`; klik otevře popover s `PropertiesPanel` (ř. 3909–4541).
- Přímo v listu jde upravit jen název listu (`input`, ř. 2748). Všech 31 typů položek se upravuje jen formulářem:
  - `PropertiesPanel`: mcq, true_false, fill_blank, matching, ordering, short_answer, open_answer, offline_activity, section_header, write_lines, instruction_box, two_boxes, blank_box, qr_link, flow_steps, image, image_text, gallery, callout;
  - `ActivityBlockEditor`: crossword, word_search, sorting, flashcards, image_hotspot, lesson_reference, image_label;
  - `TableFieldsEditor`: table; `MindMapFieldsEditor`: mind_map; `MethodStepsFieldsEditor`: method_steps; `PracticeExamplesFieldsEditor`: practice_examples.
- Změny: `updateSpec(mutator)` (ř. 787) → historie (50 kroků) + `recomputeMetadata`; autosave celé `worksheets.spec` po 1 s (ř. 684–745), při chybě obnoví, při odchodu dokončí uložení.
- Undo Ctrl+Z (ř. 803–832) se v inputu/contentEditable nechává prohlížeči. Redo neexistuje.
- Žák: `WorksheetPanel` → `WorksheetPlayer` se stejnými `ITEM_RENDERERS`, ale s odpověďmi.
- Tisk/PDF: samostatný HTML renderer `src/lib/worksheet-print-renderer.ts` (`renderItem` ř. 964, text escapuje) + `worksheet-pdf-export.ts`.

## 3. Navržený nejmenší bezpečný postup
Princip: **v etapě 1 jen prostý text, žádné HTML.** Inline pole zapisují do stejných textových polí spec, jaká dnes plní formulář. Tisk, PDF ani žákovské komponenty se proto nemění: čtou stejná data.

- Nová komponenta `InlineText` (`src/components/worksheet/InlineText.tsx`): `contentEditable="plaintext-only"` / auto-výškové textarea vypadající jako text listu. Změny po 300 ms nebo při opuštění pole → `updateSpec` (jeden krok historie na úpravu, ne na znak). Esc vrátí původní text, Enter u jednořádkových polí ukončí úpravu.
- Inline editace jen v editoru: `SortableItemBlock` nahradí `<span>` se zadáním za `InlineText`. Klik do textu edituje, klik na rám/ikonu otevře formulář jako dnes (formulář dál pro složité nastavení: správné odpovědi, body, obrázky, rozložení).
- Položky s editací uvnitř těla (nadpis sekce, rámeček s pokyny, odstavce/callout, buňky tabulky, možnosti ABCD) dostanou volitelnou vlastnost `onEditText(path, value)` jen v editorovém režimu; bez ní (žák, tisk) se chovají přesně jako dnes.
- Ochrana dat: neukládat při každém stisku, ale přes existující autosave; prázdné zadání povolit (formulář to umí také); escapování zůstává v tiskovém rendereru; staré listy beze změny (žádné nové pole, žádná migrace).
- Rich text (tučně, barvy přes `MiniRichEditor`) až v pozdější etapě, protože by vyžadoval HTML kontrakt v tisku, žákovském zobrazení a sanitizaci.

Rizika:
- Ztráta textu: rozepsaný text při přechodu na jinou položku nebo odchodu ze stránky → při `blur`/odchodu flush do `updateSpec` před autosave flushem.
- Undo: kolize nativního undo v poli a undo listu → v poli platí undo prohlížeče, mimo pole undo listu (jako dnes); jeden commit na dokončenou úpravu.
- Drag & drop: klik do textu nesmí spustit přetažení → úchyt jen na ikoně.
- Synchronizace s otevřeným formulářem: obojí čte z `spec`, tak se aktualizují navzájem.
- Možnosti/buňky přidávat/mazat dál jen formulářem (žádné rozbití struktury, `answerKeys`, mapování odpovědí u `fill_blank`).

## 4. Soubory a kroky
- Krok 1 (malý): `InlineText.tsx` + zadání položky (`prompt`) a nadpis sekce / pokyny (`section_header`, `instruction_box`) v `WorksheetEditor.tsx` / `LayoutBlockItem.tsx`. Testy: zápis do spec, Esc, jeden krok undo, žák/tisk beze změny (snapshot dat, ne markupu).
- Krok 2: texty možností `mcq`/`true_false`, texty `callout`/`image_text` (`MCQItem`, `TrueFalseItem`, `LessonVisualBlockItem`).
- Krok 3: buňky tabulky (`TableItem`, sdílená logika s `TableFieldsEditor`), případně kroky `flow_steps`.
- Rozsah: cca 6–9 souborů, každý krok samostatně testovatelný. Bez DB a bez serverových funkcí.

## 5. Mapa stránkování a prostoru pro zápis (bez návrhu, pro etapy 2–3)
- Editor: `paginateWorksheetEditorItems` (`src/lib/worksheet-editor-pagination.ts:15`) skládá celé položky podle naměřené výšky (`ResizeObserver` v `SortableItemBlock`); kapacita 1. strany 640 px, další 1009 px, mezera 8, záloha 150 (`WorksheetEditor.tsx:838`). Třídy `.worksheet-a4-page` v `src/styles/worksheet-editor.css`.
- Tisk/PDF: `.ws-page` a `body.ws-preview-paginated` v CSS z `buildWorksheetCss()` (`worksheet-print-renderer.ts:58–145, 696–803`); stránkovací skript v `buildPrintHtml` (`worksheet-pdf-export.ts:87–156`) čeká na fonty, měří spodní hranu položky, přesouvá celé položky, klíč na novou stranu; značka hlavičky `<!--ws-header-qr-->`.
- Dvě nezávislé implementace (editor vs. tisk) → náhled konce stránky v editoru se může lišit od PDF.
- Prostor pro zápis: `AnswerSpace {type: lines|grid|blank|none, heightMm, lineCount}` (`worksheet-spec.ts:142`); `write_lines` (`lineCount`, `lineStyle`, `lineHeightMm`), `blank_box` (`heightMm`, `blankStyle`), `two_boxes` (`lines:N`). Pomocníci `src/lib/worksheet-write-lines.ts` (řádek 8,5 mm, 7–12 mm, 1–20 řádků). Editor: div s pevnou výškou v mm (`WorksheetEditor.tsx:3666`), `LayoutBlockItem`; tisk: `renderAnswerSpace` (ř. 891), `write_lines` 1075, `two_boxes` 1102, `blank_box` 1122.
