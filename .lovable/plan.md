## Diagnóza importu vložených obrázků z PDF

### Body 1 a 2: Renderer a editor podporují `gallery` — v pořádku

- **Náhled lekce** (`LessonPreviewDialog.tsx`) používá `LessonBlock` z `src/components/LessonBlockRenderer.tsx`, který na řádcích 222–235 renderuje `case "gallery"` jako grid `<img>` figur.
- **BlockEditor** (`src/components/admin/BlockEditor.tsx:78`) mapuje `"gallery"` na `GalleryBlock`, který umí přidávat/mazat obrázky a upload.
- `createDefaultBlock("gallery")` v `textbook-config.ts` má správný default (`{ columns: 3, images: [...] }`).

Takže kdyby `gallery` blok vznikl s neprázdným `images[].url`, náhled by ho zobrazil. To znamená, že v datech lekce žádný `gallery` blok reálně nevznikl — `makeGalleryBlock(allEmbedded)` v `ImportTextbookFileDialog.tsx:262` vrátil `null`, protože `allEmbedded.length === 0`.

### Body 3 a 4: Root cause je v `extractPdfEmbeddedImages()`

Pro PDF vstup serverový `process-file-content` **záměrně žádné embedded obrázky nevrací** (ZIP media extraktor běží jen na `.docx`/`.pptx`), takže `serverEmbedded` je vždy `[]` a `allEmbedded` odpovídá čistě frontendovému výstupu z `extractPdfEmbeddedImages()`. Ten pro reálné PDF s ilustracemi vrací prázdné pole ze dvou spolupůsobících důvodů:

**1) `page.objs.get(name, cb)` v pdfjs 5 vyžaduje předchozí render stránky.**
V pdfjs v5 se image XObject data z workeru na main thread posílají teprve během `page.render(...)`. Samotný `page.getOperatorList()` operátory vrátí (jména XObjectů v `argsArray`), ale image objekty do `page.objs` (ani do `commonObjs`) nepropíše. Náš kód pak volá:

```
await new Promise((resolve) => {
  ...
  page.objs.get(name, resolve)   // callback se nikdy nezavolá
})
```

Callback `PDFObjects.get(id, callback)` se v pdfjs zavolá jen tehdy, když je objekt s daným `id` už resolvován, nebo když ho worker později resolvne. Bez render fáze to nikdy nenastane, takže Promise buď (a) tiše čeká donekonečna — což by ale zablokovalo celý import na kroku „Hledám vložené obrázky v PDF…" (a to se u uživatelky evidentně nestalo, protože import doběhl), nebo (b) — a to je pravděpodobnější — `commonObjs.has(name)` vrátí `false`, `page.objs.get(name, resolve)` uvnitř interně vyhodí synchronní výjimku (např. „Requesting object that isn't resolved yet"), kterou zachytí vnější `try/catch` z řádku ~122 (`catch { continue; }`), takže smyčka projde přes všechny paint opy a vrátí prázdné pole. Výsledek: 0 obrázků, žádný `gallery` blok, žádný toast o skipped images.

Že jde právě o tuto cestu potvrzuje i to, že v `pdf-page-renderer.ts` je uvnitř promisu použit vzor `try { … page.objs.get(name, resolve); } catch (e) { reject(e); }` a vnější await je obalen `try { … } catch { continue; }` — jakákoli synchronní chyba z pdfjs při čtení objektu se tedy proglkne jako „přeskočit obrázek".

**2) `OPS.paintJpegXObject` v pdfjs 5 neexistuje.**
Kontrola `node_modules/pdfjs-dist/types/src/shared/util.d.ts` ukazuje, že v pdfjs 5 zůstaly `paintImageXObject`, `paintImageXObjectRepeat`, `paintInlineImageXObject`, `paintImageMaskXObject{,Group,Repeat}`, ale `paintJpegXObject` byl odstraněn. Náš filter na řádku 82–86 to má ošetřeno `.filter((v) => typeof v === "number")`, takže se tím jen ztrácí jedna cesta, ne všechny — hlavní `paintImageXObject` stále chytáme. Vedlejší, ale zaznamenávám.

**Bonus:** `paintInlineImageXObject` (inline JPEG přímo v obsahovém streamu, běžné u fotografií exportovaných z LibreOffice/Word do PDF) nechytáme vůbec. Data inline obrázku jsou navíc přímo v `argsArray[k][0]` jako image dict, ne přes `objs.get`. Tohle vysvětluje, proč konkrétně **fotografie** krávy nemusela vzniknout ani teoreticky, i kdyby cesta přes `objs.get` fungovala.

### Že to není hardcoded UI bug

- Znovu ověřeno: `visibleBlocks` v `LessonPreviewDialog` filtruje jen `b.visible !== false`, `gallery` blok by měl `visible: true` a prošel by.
- V náhledu je `refreshKey` jen re-mount, takže „Obnovit" nic nezmění, pokud v datech blok chybí — což je zde.

### Console/network

Console logs pro tuto session prázdné (žádný záznam pro „image"), takže nemám runtime důkaz o konkrétní chybové hlášce z `page.objs.get`. Serverový `process-file-content` pro PDF vrací `embeddedImages: []` už jen tím, že jde o PDF (ZIP extraktor běží jen na docx/pptx), takže network tab by nic užitečného neukázal.

### Root cause souhrn

Frontend `extractPdfEmbeddedImages()` v `src/lib/pdf-page-renderer.ts` čte image data přes `page.objs.get(name, cb)` po `getOperatorList()`, ale v pdfjs 5 nejsou image XObjects po pouhém `getOperatorList()` na main threadu dostupné — musí předcházet `page.render()`. Bez toho `objs.get` buď zavěsí, nebo (pravděpodobněji, s ohledem na to že import doběhne) shodí synchronní výjimku, kterou spolkne vnější `try/catch`. Navíc inline JPEG obrázky (běžný způsob vkládání fotek do PDF) nezpracováváme vůbec, protože nechytáme `paintInlineImageXObject`.

### Návrh opravy (čekám na souhlas, zatím neimplementuji)

1. V `extractPdfEmbeddedImages()` **před** čtením obrázků z každé stránky provést render stránky do off-screen canvasu (throwaway), aby pdfjs propíchl image XObjects do `page.objs`. Kanvas můžeme rovnou zahodit — cíl je jen resolvovat objs.
2. Přidat větev pro `OPS.paintInlineImageXObject`, kde image dict je přímo `argsArray[k][0]` (má `.width`, `.height`, `.data`/`.bitmap` už teď na main threadu) a nejde přes `objs.get`.
3. Přidat timeout kolem `objs.get` (např. 5 s per obrázek) jako pojistku proti hangu.
4. Volitelně sdílet už vyrenderované stránky z `renderPdfPagesToImages()` (obě funkce dnes otevírají PDF nezávisle) — dá se sloučit do jednoho průchodu a ušetřit CPU/paměť.

Žádné jiné soubory měnit není potřeba; `LessonBlockRenderer`, `GalleryBlock`, `ImportTextbookFileDialog` gallery-block cesta i `textbook-config` jsou v pořádku.
