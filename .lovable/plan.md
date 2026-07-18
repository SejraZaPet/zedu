## Cíl
Najít přesný bod selhání `extractPdfEmbeddedImages()` při importu PDF s vloženými obrázky a doložit ho reálným logem/error výstupem. Neprovádět produkční opravu, dokud nebude jasný nález.

## Ověřený aktuální stav
- Headless browser je v sandboxu dostupný: Python Playwright import prošel.
- Nainstalovaná PDF knihovna je `pdfjs-dist` `^5.7.284`.
- `vite.config.ts` zatím nemá `optimizeDeps.exclude` pro `pdfjs-dist`.
- `extractPdfEmbeddedImages()` už obsahuje debug logování a používá:
  - `getDocument()`
  - `page.render({ canvas, canvasContext, viewport })`
  - `page.getOperatorList()`
  - `OPS.paintImageXObject`, `OPS.paintImageXObjectRepeat`, `OPS.paintInlineImageXObject`, `OPS.paintJpegXObject`, `OPS.paintImageMaskXObject`
  - `page.objs/commonObjs.get()` přes timeout wrapper
- Existuje diagnostická stránka `/__pdf-diag`, která volá `extractPdfEmbeddedImages(file, { debug: true })`.

## Diagnostický postup
1. **Přidat pouze dočasnou diagnostickou instrumentaci**
   - Rozšířit logy v `extractPdfEmbeddedImages()` tak, aby explicitně vypsaly:
     - verzi `pdfjs-dist`, počet stran, velikost vstupního PDF,
     - skutečné hodnoty všech používaných `OPS` konstant,
     - pro každou stránku: viewport rozměry při `scale: 0.5`, canvas rozměry, výsledek `page.render()`, výsledek `getOperatorList()`, počty image paint operací podle typu,
     - pro každý XObject název: zda byl v `commonObjs`/`objs`, zda `getObj()` vrátil non-null, klíče objektu, rozměry, datový typ, velikost dat,
     - každý důvod přeskočení kandidáta,
     - finální počet vytvořených Blobů.
   - Logy ponechat pouze při `debug: true`, aby se neměnilo běžné produkční chování.

2. **Otestovat čistě v browser kontextu přes `/__pdf-diag`**
   - Vygenerovat syntetické PDF s vloženými rastrovými PNG/JPEG obrázky přes Node skript a uložit ho do `/tmp/browser/...`.
   - Playwright otevře lokální aplikaci na `http://localhost:8080/__pdf-diag`, nahraje syntetické PDF do `<input type=file>`, zachytí console logy i page errors a počká na výsledek.
   - Výstupem bude kompletní console log, včetně případného `Map.prototype.getOrInsertComputed` nebo jiného runtime erroru.

3. **Otestovat reálný import flow, pokud půjde obnovit přihlášení**
   - Zkontrolovat stav auth injekce v sandboxu.
   - Pokud je dostupná managed session, obnovit ji v Playwright podle bezpečného postupu a otevřít stránku, kde je `ImportTextbookFileDialog` dostupný pro admin/teacher účet.
   - Nahrát stejné syntetické PDF do reálného dialogu a sledovat console logy + upload počet URL.
   - Pokud auth injekce dostupná nebude, doložit to a pokračovat s `/__pdf-diag`, protože ta testuje stejnou extrakční funkci v reálném Vite/browser prostředí.

4. **Zvláštní ověření podezřelých bodů**
   - Ověřit, zda `page.render()` v aktuálním `pdfjs-dist` padá kvůli parametru `canvas` v render contextu; v diagnostice případně provést A/B test renderu:
     - `{ canvas, canvasContext, viewport }`
     - `{ canvasContext, viewport }`
   - Vypsat skutečné hodnoty `OPS.paintImageXObjectRepeat`, `OPS.paintInlineImageXObject`, `OPS.paintJpegXObject`, `OPS.paintImageMaskXObject`.
   - Zalogovat viewport/canvas rozměry a zachytit chyby pro případ canvas size limitu.

5. **Report bez produkční opravy**
   - Vrátit strukturovaný report:
     - přesný bod selhání,
     - kompletní relevantní log výstup,
     - zda selhává render, operator list, `getObj`, width/height filtr, decode, nebo upload,
     - zda jde o Vite/pdfjs bundling problém, API signaturu, OPS konstanty, canvas limit, nebo jinou příčinu,
     - doporučení, jestli dočasné logy odstranit nebo nechat pouze za dev/debug flagem.

## Co se zatím nebude dělat
- Nebude se měnit produkční extrakční algoritmus ani importní flow jako oprava.
- Nebudou se mazat ani měnit data v databázi/storage.
- Nebude se deployovat ani publikovat aplikace.