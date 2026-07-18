## Bod 1 — Filtr na page-coverage ratio v `extractPdfEmbeddedImages()`

**Soubor:** `src/lib/pdf-page-renderer.ts`

**Princip:**
Pro každou stránku sledovat CTM (current transformation matrix) skrz operátorový seznam a při každém `paintImageXObject` / `paintImageXObjectRepeat` / `paintInlineImageXObject` zjistit **painted size v PDF user units** = `|a|` × `|d|` z aktuální matice. Porovnat s `page.getViewport({ scale: 1 })`.

Pokud platí obojí:
- `paintedWidth / viewportWidth ≥ 0.85`
- `paintedHeight / viewportHeight ≥ 0.85`

→ obrázek považovat za celoslidové pozadí a přeskočit s reason `"full-page-background"`.

Práh **0.85** (nikoli 0.80) je zvolený tak, aby velké, ale legitimní ilustrace (typicky max ~70–75 % šířky sazby v učebnici) prošly, zatímco skutečná pozadí (≥ 90 % obou rozměrů) se odfiltrují.

**Implementační detail — sledování CTM:**
V pdfjs operator listu se objevují operace:
- `OPS.save` — push aktuální matice na stack
- `OPS.restore` — pop
- `OPS.transform` s args `[a,b,c,d,e,f]` — násobí current CTM zprava

Pro filtr **nepotřebujeme plnou násobící logiku matic** — stačí zaznamenat scale `(a, d)` z posledního `OPS.transform` uvnitř aktuálního `save`/`restore` bloku bezprostředně před paint op. To odpovídá běžnému pdfjs vzoru:

```text
save → transform([sw, 0, 0, sh, tx, ty]) → paintImageXObject(name) → restore
```

kde `sw` = painted width v points, `sh` = painted height v points. Pokud vzor nesedí (např. složená transformace), fallback: neaplikovat filtr, obrázek propustit (bezpečná varianta — raději trochu šumu než zahodit legitimní ilustraci).

**Změny v kódu (přesně):**
1. Přidat parametr `pageCoverageThreshold?: number` (default `0.85`) do `opts`.
2. Uvnitř smyčky `for (let k = 0; ...)`:
   - Před testem rozměrů vypočíst `paintedW`, `paintedH` z posledního `OPS.transform` před tímto paint op v rámci aktuálního save/restore bloku.
   - Získat viewport `page.getViewport({ scale: 1 })` jednou před smyčkou.
   - Pokud `paintedW / viewport.width ≥ threshold && paintedH / viewport.height ≥ threshold` → `bump("full-page-background", { page: i, index: k, paintedW, paintedH, viewportW, viewportH })` a `continue`.
3. Nechat existující dimension filtry (`< 16`, `> 4000`) beze změny — jsou ortogonální.

**Debug:** logovat coverage ratio i pro obrázky, které projdou, jen když `debug: true` (což aktuálně `ImportTextbookFileDialog.tsx` nevolá — správně).

## Bod 2 — Chybějící tabulka

**Nález:** `extractPdfText()` je byte-identická napříč všemi commity od svého zavedení. Žádné vedlejší úpravy. Do AI se posílá stejný raw text jako dříve.

**Akce:** žádná změna kódu v této fázi. V shrnutí uživatelce navrhnu diagnostický krok: nechat ji poslat konkrétní PDF, spustíme jednorázově `extractPdfText()` a ověříme, jestli je slovo z tabulky vůbec v raw textovém streamu. Podle výsledku pak buď (a) vylepšit strukturu prompt pro AI (explicitní „zachovej tabulky jako Markdown"), nebo (b) přidat vision fallback pro stránky s nízkým textovým výtěžkem.

## Rozsah

Jediná změna: `src/lib/pdf-page-renderer.ts`, funkce `extractPdfEmbeddedImages()`. Žádné jiné soubory, žádné migrace, žádné edge funkce.
