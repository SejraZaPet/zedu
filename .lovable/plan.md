# Diagnostika extractPdfText() — regrese po optimizeDeps.exclude

Cíl: zjistit, proč `extractPdfText()` vrací prázdno pro všech 8/8 stránek v čerstvém buildu (i s raw fallbackem), a ověřit, jestli to souvisí s `optimizeDeps.exclude: ["pdfjs-dist"]` ve `vite.config.ts`. **Žádné funkční změny** — pouze instrumentace + headless test.

## Krok 1 — Instrumentace `src/lib/pdf-page-renderer.ts`

V `extractPdfText()`:

1. **Vnější `try/catch` kolem celého těla funkce** s `console.error("[pdf-text-diag] extractPdfText FAILED", err)` a re-throw, aby žádná tichá chyba (v `getDocument`, `getPage`, `getTextContent`) neprošla nezalogovaná.

2. **Na začátku funkce** (před `getDocument`):
   ```
   console.log("[pdf-text-diag] START", {
     fileName, fileSize, fileType,
     pdfjsVersion: (pdfjsLib as any).version,
     workerPort: !!pdfjsLib.GlobalWorkerOptions.workerPort,
     workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc,
   });
   ```

3. **Hned po `await getDocument(...).promise`**:
   `console.log("[pdf-text-diag] PDF loaded", { numPages: pdf.numPages });`
   Pokud throw → vnější catch to zaloguje.

4. **Uvnitř per-page smyčky**, hned po `page.getTextContent()`:
   ```
   console.log("[pdf-text-diag] page", i, {
     itemsLength: items.length,
     firstFive: items.slice(0, 5).map(it => ({
       str: it.str, hasEOL: it.hasEOL,
       transform: it.transform, width: it.width,
     })),
   });
   ```
   A po výpočtu `raw` + `rendered`:
   ```
   console.log("[pdf-text-diag] page", i, "extracted", {
     rawLen: raw.length, renderedLen: rendered.length,
   });
   ```

Prefix `[pdf-text-diag]` pro snadné filtrování. Instrumentace je čistě additive, nemění výstup.

## Krok 2 — Headless test na syntetickém PDF

Skript pod `/tmp/pdf-diag/`:

1. Vygenerovat malé testovací PDF přes `pdf-lib` (2 stránky, jednoduché texty + jedna tabulka řádků se zarovnanými x-souřadnicemi), uložit do `/tmp/pdf-diag/test.pdf`.
2. Spustit Playwright (`headless=True`, viewport 1280×1800) proti `http://localhost:8080` na dočasnou stránku nebo přes existující diagnostiku, případně injektovat modul přes `page.evaluate` a naimportovat `/src/lib/pdf-page-renderer.ts` dynamicky.
   - Jednodušší varianta: dočasně přidat mini test route `/__pdf-text-diag`, která přijme `File` z `<input type=file>` nebo z `fetch("/tmp/pdf-diag/test.pdf")` a zavolá `extractPdfText`. (Cleanup route odstraníme po diagnostice — jako minule s `/__pdf-diag`.)
3. Zachytit `console` eventy (`page.on("console", ...)`), uložit do `/tmp/pdf-diag/log.txt`, `tail`/`grep` pro `[pdf-text-diag]`.

## Krok 3 — Interpretace

- **Vnější catch se trigne** → přesná chyba (worker, getDocument, getTextContent).
- **`items.length === 0`** na všech stránkách → problém v pdfjs načítání textového obsahu (worker/exclude side-effect).
- **`items.length > 0` ale `rawLen === 0`** → regrese v raw fallback logice.
- **Syntetický test projde OK, produkční PDF ne** → problém specifický pro konkrétní PDF (font/enkódování), potřeba získat reálný soubor.

## Krok 4 — Cleanup

Po odsouhlasené opravě: odstranit `[pdf-text-diag]` logy, případnou dočasnou route `/__pdf-text-diag` a `/tmp/pdf-diag/` obsah.

## Technické poznámky

- `pdfjsLib.GlobalWorkerOptions.workerSrc` může být `undefined`, když je nastaven jen `workerPort` (což je náš případ přes `?worker` import) — v logu je to očekávané, hlavní check je `workerPort: true`.
- `optimizeDeps.exclude` by neměl mít vliv na runtime chování `getTextContent()`, ale ovlivňuje bundlování/HMR — diagnostika to potvrdí nebo vyvrátí.
- Instrumentace nezvyšuje bundle produkčně měřitelně; přesto ji po diagnostice odstraníme.
