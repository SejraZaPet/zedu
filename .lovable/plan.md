# Kompaktní „Výběr z možností“ v náhledu, tisku a PDF

Návrh. Nic se zatím nemění, migrace není potřeba (jen vzhled).

## 1. Kde se položka vykresluje

Dvě nezávislé cesty:

- **Digitální přehrávač a „Náhled“ v editoru** – `src/components/worksheet-items/MCQItem.tsx` ř. 22–34: každá možnost je `flex … p-3 rounded-lg border`, mezi možnostmi `space-y-2`, RadioGroup s plným kolečkem. Tohle jsou ty „vysoké rámečky“. Náhled v editoru (`src/pages/WorksheetEditor.tsx` ř. 2786–2797) používá `WorksheetPlayer`, tedy právě tento digitální vzhled, ne tiskový. A4 rámeček stránky dělá `WorksheetPlayer.tsx` ř. 370.
- **Tisk / PDF / „PDF pro pero“** – `src/lib/worksheet-print-renderer.ts`:
  - HTML `mcq` ř. 921–924: `<ol class="ws-choices">` s písmeny „A)“, bez rámečků.
  - CSS ř. 368–389: `.ws-choices` margin 6pt, `li` padding `var(--ws-choice-pad)` a line-height 1.5, značka min. 26pt.
  - Hlavička otázky ř. 333–365: `margin-bottom 6pt + padding-bottom 4pt`, číslo 12–14pt, line-height 1.4, body vpravo 8.5pt.
  - Celá položka ř. 324–331: `break-inside: avoid`, mezera `--ws-item-gap`.
  - PDF (`worksheet-pdf-export.ts` ř. 56) a „PDF pro pero“ v sešitě používají stejné HTML.
- **Pravda/nepravda** má vlastní styl (`.ws-tf-*` ř. 391 a dál, `TrueFalseItem.tsx`). Samostatný typ „Více správných“ ve schématu není (`worksheet-spec.ts` ř. 402), takže se ho změna netýká.

## 2. Proč „Kompaktní“ výběr nezmenší

„Hustota tisku“ (`WorksheetEditor.tsx` ř. 2290, `printDensityOf` ř. 1379–1386) jen přepíná proměnné CSS v tiskovém HTML (ř. 110–143). Možnost se při ní mění jen o 3–5pt odsazení. Hlavní objem tvoří pevné hodnoty, které hustota neřídí: line-height 1.5, okraje seznamu 6pt, hlavička 10pt.

Digitální náhled (`MCQItem`) hustotu nečte vůbec. Proto učitelka v náhledu vidí velké rámečky bez ohledu na nastavení. Je pravděpodobné, že hlášený „náhled“ je právě tento. Je to vyčtené z kódu, na její obrazovce neověřené.

## 3. Návrh nejmenší změny

**A. Tiskové HTML a PDF** (jen `worksheet-print-renderer.ts`):
- Nové proměnné hustoty:
  - `--ws-choice-pad` (compact 0.5pt, normal 1.5pt, loose 3pt);
  - `--ws-choice-lh` (1.15 / 1.25 / 1.4);
  - `--ws-header-gap` (2pt / 4pt / 6pt).
  Stávající `--ws-item-gap` (4/7/10 mm) zůstává.
- `.ws-choices`: okraj `2pt 0 0 18pt`, bez rámečků.
- Každá možnost dostane malý čtvereček na zakroužkování: `.ws-choice-box` 3 mm, 0.6pt šedá čára. Písmeno zůstane „A)“, takže klíč i odkazy na písmena platí.
- Dva sloupce u krátkých možností (`ws-choices--2col`, `display:grid; grid-template-columns:1fr 1fr; column-gap:8mm`). Pořadí A, B v prvním řádku a C, D ve druhém. O sloupcích rozhodne renderer: dva sloupce, když jsou 3–4 možnosti a každá má nejvýš ~38 znaků; jinak jeden sloupec. Čistá funkce `mcqColumns(choices)`.
- Zadání tučně zůstává (font-weight 600 → 700), body malé vpravo zůstávají.
- `break-inside: avoid` na `.ws-item` je beze změny.
- Odhad: 5 otázek A–D na A4 při „Kompaktní“, 3–4 při „Běžná“.

**B. Náhled v editoru**:
Dialog „Náhled“ přepnout na vykreslení tiskového HTML (stejné jako PDF). Přehrávač dostane volbu „Tiskový náhled“, nebo se v dialogu zobrazí `renderWorksheetVariantHtml`. Učitelka pak uvidí přesně to, co se vytiskne, včetně hustoty.

## 4. Digitální vzhled pro žáka

`MCQItem` se nemění: zůstanou velké dotykové plochy, minimálně 44 px. Kompaktní vzhled platí jen pro náhled tisku, tisk, PDF a „PDF pro pero“. Řídí ho stávající volba „Hustota tisku“.

## 5. Rizika a testy

**Rizika:**
- **Počet stran:** stávající listy budou v tisku kratší. Mění se jen vzhled, uložená data ne. Učitelka s rozvrženým listem může vidět jiné zalomení stránek, proto to uvedu v poznámce ke změně.
- **Tiskové testy:**
  - `worksheet-print-density` (mezery 4/7/10 mm) se nemění;
  - `worksheet-table-row-height` (10 mm) se tabulek netýká;
  - testy klíče správných odpovědí se nemění, písmena zůstávají.
- **Přístupnost tisku:** čtvereček 3 mm a mezera mezi řádky minimálně ~5 mm stačí k označení tužkou. Písmo zůstává 11pt, kontrast beze změny.
- **Demo ochrany:** nedotčené, jde jen o vzhled.

**Testy** (nový `src/test/worksheet-mcq-compact.test.ts`):
1. `mcqColumns`:
   - 4 krátké možnosti → 2 sloupce;
   - jedna dlouhá možnost → 1 sloupec;
   - 5 a více možností → 1 sloupec.
2. HTML `mcq` obsahuje `ws-choice-box` a písmena A)–D) a při krátkých možnostech třídu `ws-choices--2col`.
3. CSS: compact `--ws-choice-lh` je 1.15 a je menší než u normal.
4. Odhad výšky: model výšky otázky (hlavička + řádky × line-height + mezera) při compact dá pro 5 otázek A–D ≤ 273 mm, při normal 3–4 otázky.
5. Kontrola tisku přes Playwright (vykreslené HTML na A4): 5 otázek se vejde na první stránku a žádná otázka se nerozdělí.
6. Stávající tiskové testy a celá sada musí projít beze změny.

## 6. Migrace

Migrace není potřeba. Mění se jen CSS a HTML tisku a náhled v editoru, uložený list ani databáze se nemění.

## Dotčené soubory
- `src/lib/worksheet-print-renderer.ts`
- `src/pages/WorksheetEditor.tsx` (jen dialog Náhled)
- nový test
