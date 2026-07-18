## Cíl
Přidat dočasnou diagnostiku bez změny funkčního chování, abychom s reálnými daty ověřili body 2 (tabulka) a 3 (page rendery) z hlášené regrese.

## Aktuální stav (ověřeno čtením `src/components/admin/ImportTextbookFileDialog.tsx`)

Rozhodovací logika pro vkládání page renderů je správně napojená na `extractPdfText().pages`:

```ts
// řádky 128–136
const TEXT_QUALITY_THRESHOLD = 30;
const pagesNeedingRender = new Set<number>();
if (isPdf && textPages.length > 0) {
  for (const p of textPages) {
    if (p.charCount < TEXT_QUALITY_THRESHOLD) pagesNeedingRender.add(p.pageNumber);
  }
}
// řádky 147–152 — page se skipne pokud NENÍ v pagesNeedingRender
for (let i = 0; i < pageImages.length; i++) {
  const pageNumber = i + 1;
  if (!pagesNeedingRender.has(pageNumber)) { pageImageUrls.push(""); continue; }
  ...
}
// řádek 313 — vloží jen pokud non-empty
if (pageImageUrls[pageIdx]) out.push(makeImageBlock(...));
```

Žádná stará „vždycky vkládej" větev v kódu nezůstala. To znamená: buď `charCount` je pro každou stránku pod 30 (a proto se page image vloží pro každou stránku), nebo se propouští jinou cestou. Diagnostika to potvrdí.

Pro tabulku: `extractPdfText()` v `pdf-page-renderer.ts` skládá výstup s markdown `|`. Text jde do `invokeBody.extractedText` (řádek 216). Otázka je, jestli řádky `|` reálně vznikají, a jestli se posílají celé.

## Diagnostické změny (jen `console.log`, žádné funkční změny)

Všechny logy prefixovat `[import-diag]`, aby se daly snadno filtrovat a poté smazat.

**A) `src/components/admin/ImportTextbookFileDialog.tsx`**

1. Po `extractPdfText` (za řádkem 118): vypsat kompletní per-page tabulku:
   ```ts
   console.log("[import-diag] textPages", textPages.map(p => ({ page: p.pageNumber, charCount: p.charCount, willRender: p.charCount < 30 })));
   console.log("[import-diag] threshold", 30, "pagesNeedingRender", Array.from(pagesNeedingRender));
   ```
   (druhý log posunout až za konstrukci setu, řádek ~136)

2. Uvnitř smyčky renderu stránek (kolem řádku 148): pro každou stránku vypsat rozhodnutí:
   ```ts
   console.log("[import-diag] page", pageNumber, "charCount", textPages.find(p => p.pageNumber === pageNumber)?.charCount, "inserted", pagesNeedingRender.has(pageNumber));
   ```

3. Před `supabase.functions.invoke("process-file-content", ...)` (kolem řádku 220): spočítat markdown tabulkové řádky a ověřit, že skutečně tečou do payloadu:
   ```ts
   const tableLineCount = (extractedText.match(/^\s*\|.*\|\s*$/gm) || []).length;
   const bodyText = typeof invokeBody.extractedText === "string" ? invokeBody.extractedText : "";
   const bodyPipeCount = (bodyText.match(/\|/g) || []).length;
   console.log("[import-diag] extractedText length", extractedText.length, "table-like lines", tableLineCount, "sending as extractedText?", "extractedText" in invokeBody, "body pipe count", bodyPipeCount);
   // vzorek prvních 3 tabulkových řádků, ať vidíme jak vypadají
   const sample = (extractedText.match(/^\s*\|.*\|\s*$/gm) || []).slice(0, 5);
   console.log("[import-diag] table sample", sample);
   ```

**B) Bez editace `pdf-page-renderer.ts`** — vše potřebné se dá odvodit z výstupu `extractPdfText()`, který volající už má. Vyhneme se úpravě knihovny, o kterou uživatelka nežádala.

## Co uživatelka udělá
1. Spustí import stejného PDF, který dřív dělal problémy.
2. Otevře DevTools → Console, vyfiltruje `[import-diag]`.
3. Pošle celý výpis (nebo screenshot).

## Očekávané výstupy diagnostiky
- **Bod 3 (page renders):** `textPages` řekne, jaké `charCount` má která stránka. Pokud jsou všechny < 30 → text extrakce reálně nedodala text (jiný root cause, ne regrese threshold logiky). Pokud jsou vysoké a přesto se rendery vkládají → někde jinde bug.
- **Bod 2 (tabulka):** `table-like lines` a `table sample` ukáže, jestli tabulka vůbec vzniká v extrakci. `body pipe count` potvrdí, že se dostává do AI promptu beze změny.

## Další krok (po výsledku diagnostiky)
Podle čísel navrhnu cílenou opravu (např. snížit/zrušit threshold nebo opravit clusterRows/detectTableRanges) a odstraním diagnostické logy.

## Rozsah
- 1 soubor: `src/components/admin/ImportTextbookFileDialog.tsx`
- Přidáno ~5 řádků logů, žádná funkční změna.
