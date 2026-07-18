## Cíl

Nahradit jednu gallery na konci lekce sadou menších gallery bloků vložených **za odpovídající divider** (= konec dané stránky PDF). Fallback pro obrázky, jejichž stránku nelze namapovat, zůstane připojený na konec.

## Změny

### 1. `src/lib/pdf-page-renderer.ts`
Změnit návratový typ `extractPdfEmbeddedImages()` z `Blob[]` na `{ pageNumber: number; blob: Blob }[]`. Uvnitř smyčky `for (let i = 1; ...; i++)` má funkce už `i` (1-based page number) — místo `out.push(blob)` push `{ pageNumber: i, blob }`. JSDoc aktualizovat.

Bez další změny logiky (filtry, coverage check, dedup zůstávají).

### 2. `src/components/admin/ImportTextbookFileDialog.tsx`

**Upload smyčka (ř. 146–161):** iterovat nad novou strukturou; místo `pdfEmbeddedImageUrls: string[]` používat `pdfEmbeddedImagesByPage: Map<number, string[]>` (page number → seznam URL). Cestu ve storage nechat stejnou, přidat page do názvu pro čitelnost: `pdf-embedded/{folder}/page-{N}-image-{i}.jpg`.

**Server embedded (DOCX/PPTX, ř. 210):** `serverEmbedded` nemá page info → zůstávají ve fallback koši (bez stránky).

**enrichBlocksWithPages:** rozšířit tak, aby vedle full-page renderu vkládal i **gallery blok s embedded obrázky z dané stránky**. Konkrétně:
- Před vstupem do smyčky: pokud stránka 1 (`pdfEmbeddedImagesByPage.get(1)`) obsahuje URL, vložit po případném full-page image i gallery blok pro stránku 1.
- Ve smyčce, po detekci `divider` a inkrementu `pageIdx`: pokud `pdfEmbeddedImagesByPage.get(pageIdx + 1)` má URL, vložit gallery blok pro tuto stranu (za full-page image, pokud existuje).
- Po smyčce: mezi leftover full-page renders připojit i všechny gallery bloky pro stránky, které do dividerů nespadly (`pageNumber > pageIdx + 1` nebo mapa má klíče, které jsme nepoužili).

Sledovat `usedPages: Set<number>` pro zabránění duplicitám a k detekci leftoverů.

**Sloučené odstranění staré gallery:** `makeGalleryBlock`/`embeddedGalleryBlock` zůstává, ale volá se teď dvakrát způsobem:
- Per-page (s URL z jedné stránky) uvnitř `enrichBlocksWithPages`.
- Fallback: **jedna gallery na konec** obsahující pouze `serverEmbedded` (DOCX/PPTX) + nemapované PDF obrázky (leftover), pokud nějaké jsou.

Efekt: pro PDF s dobrým dividerováním se obrázky rozprostřou po lekci; pro DOCX/PPTX zůstává současné chování (jedna galerie na konci); mixed a edge cases dostanou fallback galerii navíc na konci.

## Nejde v tomto kroku řešit

- Přesné umístění u konkrétního odstavce — vyžadovalo by layout analýzu.
- Případy, kdy AI negeneruje dividery (single-page prompt, nebo AI je vynechá) — obrázky pak spadnou do leftover fallback galerie na konci lekce.
- `serverEmbedded` z DOCX/PPTX nemá page info — zůstává v koncové galerii.

## Rozsah

Dva soubory:
- `src/lib/pdf-page-renderer.ts` — jen signatura návratu.
- `src/components/admin/ImportTextbookFileDialog.tsx` — upload smyčka, `enrichBlocksWithPages`, sestavení lessons.

Žádné DB migrace, žádné edge funkce, žádné změny na straně `process-file-content` ani AI promptu.
