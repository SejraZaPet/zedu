
## Cíl
Najít PŘESNÝ bod selhání `extractPdfEmbeddedImages()` na PDF exportu z PowerPointu s vloženými rastrovými obrázky. Žádná další hypotéza — musíme mít log/error z reálného běhu.

## Kontext (ověřeno)
- `pdfjs-dist` verze **5.7.284** (moderní API, `page.render({ canvasContext, viewport })` — `canvas` v argumentech je akceptovaný, ale nepovinný; toto pravděpodobně NENÍ problém).
- Sandbox Playwright je k dispozici (Chromium, headless).
- Funkce `extractPdfEmbeddedImages` je v `src/lib/pdf-page-renderer.ts` (řádky 71–232).

## Plán diagnostiky

### Krok 1 — Instrumentace (dočasně, za `import.meta.env.DEV` nebo za lokální flag)
Do `extractPdfEmbeddedImages()` přidat `console.log` (prefix `[pdf-img-extract]`):
1. Verze pdfjs a hodnoty OPS konstant (`paintImageXObject`, `paintImageXObjectRepeat`, `paintInlineImageXObject`, `paintJpegXObject` pokud existuje).
2. Na začátku: `pdf.numPages`.
3. Pro každou stránku: počet `fnArray` operací, počítadlo výskytů podle typu op (xobject / inline / jiné image ops), rozměry viewportu (scale 0.5), výsledek `page.render()` (success/error).
4. Pro každé `paintImageXObject`: název XObjectu, výsledek `getObj` (null / objekt s poli — vypsat `Object.keys`, `width`, `height`, přítomnost `bitmap`/`data`, `data.length` pokud existuje).
5. Důvod přeskočení (`no-name`, `dedup`, `getObj-null`, `no-dims`, `too-large`, `too-small`, `no-drawable`, `unsupported-channels`, `render-error`).
6. Finální souhrn: `{ pagesProcessed, opsSeen, xobjectOpsSeen, inlineOpsSeen, imagesResolved, imagesSkippedByReason, imagesReturned }`.

### Krok 2 — Syntetické PDF s vloženými obrázky
Sandbox skript pod `/tmp/pdf-diag/`:
- `make-pdf.mjs`: přes `pdf-lib` vytvoří 2-stránkové PDF, každá stránka obsahuje `embedPng` a `embedJpg` (jednoduché barevné bitmapy 200×200) → `/tmp/pdf-diag/test.pdf`.
- `run-diag.mjs`: Playwright script — spustí dev server na `localhost:8080` (už běží), přihlásí se přes injectovanou Supabase session, otevře stránku, která zavolá `extractPdfEmbeddedImages(testFile)` (buď existující dialog, nebo dev-only route). Zachytí `console` eventy s prefixem `[pdf-img-extract]` a vypíše je.

Alternativa pokud UI cesta bude křehká: přidat **dev-only** route `/__pdf-diag` (guardovaná `import.meta.env.DEV`), která má file input a zavolá funkci; Playwright do ní nahraje `test.pdf`.

### Krok 3 — Reálné PDF od uživatelky (pokud dostupné)
Pokud uživatelka poskytne konkrétní PDF (nebo najdeme sample v Supabase storage), spustit stejný `run-diag.mjs` znovu proti němu a porovnat log se syntetickým případem.

### Krok 4 — Vyhodnocení
Podle logu identifikovat root cause. Typické scénáře, které log jasně odliší:
- **A**: `getObj` vždy vrací `null` → problém s `objs`/`commonObjs` transferem i po `page.render()`.
- **B**: `imgObj` má neznámou strukturu (např. `{ src: ImageBitmap }` nebo `{ kind, data }` s neobvyklým `kind`) → náš rozbor `bitmap`/`data` je nekompletní.
- **C**: `channels` vychází nesmyslně (např. 2, 6) → CMYK/indexed color, potřeba jinou dekódovací cestu.
- **D**: `paintImageXObject` se v tomto PDF vůbec nevyskytuje, obrázky jsou přes jiný op (`paintFormXObjectBegin` + vnořené image ops), nebo přes SMask.
- **E**: `page.render()` failuje kvůli `willReadFrequently`/OffscreenCanvas rozdílu ve Playwright headless.

### Krok 5 — Prezentace nálezu
Vrátit uživatelce:
- Přesná verze pdfjs a hodnoty OPS.
- Kompletní log z běhu na syntetickém PDF (+ reálném, pokud bude).
- Konkrétní root cause s citací řádku z logu.
- Návrh opravy — až po schválení.

### Krok 6 — Úklid
Instrumentaci ponechat za `import.meta.env.DEV` flagem (tichá v produkci), nebo odstranit — rozhodneme podle nálezu. Případnou dev-only route odstranit.

## Co NEDĚLÁM v tomto plánu
- Neměním produkční chování extractoru.
- Neupravuju edge funkci `process-file-content`.
- Neopravuji nic, dokud neukážu log a nedostanu souhlas.

## Souhlas
Potvrď prosím, ať můžu:
1. Přidat instrumentaci (dev-flag) do `pdf-page-renderer.ts`.
2. Vytvořit dočasnou dev-only diagnostickou stránku + syntetické testovací PDF.
3. Spustit Playwright běh a vrátit log.
