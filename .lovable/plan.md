# Diagnostika: klíč odpovědí a „Verze pro učitele“ v náhledu a tisku

Zjištěno jen čtením kódu. Nic se neměnilo.

## 1. Jak se volby předávají
- V dialogu Export PDF jsou volby uložené ve stavu `pdfVersion`, `pdfIncludeAnswerKey`, `pdfIncludeNameField` a `teacherNotes` (`src/pages/WorksheetEditor.tsx` ř. 416–418).
- **Tisk / PDF** volá `downloadWorksheetPdf` (ř. 1071–1076). **Náhled** v exportním dialogu volá `buildWorksheetPdfBlobUrl` (ř. 1122–1127). Obě cesty dostávají stejné volby: `teacherVersion`, klíč (u učitelské verze vždy zapnutý), poznámky a pole pro jméno. Obě pak používají `buildPrintHtml`, tedy stejné HTML i stejný skript pro dělení na stránky (`src/lib/worksheet-pdf-export.ts` ř. 37–128).
- Samostatné tlačítko **Náhled** v liště editoru (ř. 2473 a 2553) otevírá jiný dialog (ř. 2787–2797). Ten volá `renderWorksheetVariantHtml(spec, variantId)` **bez voleb**. Vždy proto ukazuje žákovskou verzi bez poznámek, bez QR a bez dělení na stránky. Klíč ukáže jen tehdy, když ho má zapnutý sám list (`renderConfig.includeAnswerKey`). Je to nesoulad, ale za hlášenou chybu nemůže: oranžový rámeček se v tomto náhledu vůbec nevykreslí.

## 2. Kde se vykresluje blok učitele a proč je oříznutý
- Blok učitele vzniká v `renderTeacherBlock` (`worksheet-print-renderer.ts` ř. 1472–1481) a klíč v `renderAnswerKey` (ř. 1359–1389). Do dokumentu se vkládá na ř. 1512–1518 a 1536–1540. Leží **za** `.ws-items`, ale **uvnitř** `.ws-content` první stránky.
- **Příčina:** skript pro dělení na stránky (`worksheet-pdf-export.ts` ř. 87–121) přesouvá na další stránky jen potomky `.ws-items`. Blok učitele zůstane v `.ws-content` **první** stránky za úlohami, které se na ni vešly. V náhledu má `.ws-content` pevnou výšku 267 mm a `overflow: hidden` (CSS ř. 682–692). Blok proto přeteče ven a ořízne se. Vidět zůstane jen horní okraj oranžového rámečku, což přesně odpovídá hlášení. Pravidlo `break-before: page` (ř. 1432–1433) na obrazovce nic nedělá.
- Typ úlohy ani obsah klíče na tom nic nemění. Klíč se vygeneruje, ale je skrytý.
- **Výběr z možností:** `renderAnswerKey` vypisuje `correctAnswer` tak, jak je uložené (ř. 1367). Žádné písmeno A–D k němu nepřidává. Pokud se ukládá text možnosti, v klíči je jen text bez písmene. Jak přesně se `correctAnswer` u této úlohy ukládá, ověřím na začátku opravy.

## 3. Tisk / PDF
- Tisk používá stejné rozdělené HTML. V `@media print` platí `overflow: visible` (ř. 765–780), takže se blok neořízne. Zůstane ale na **první** stránce DOM a pomocí `break-before: page` se vytiskne jako 2. stránka, **před** stránkami s dalšími úlohami. U víceстránkového listu tak klíč skončí uprostřed. Když je první stránka plná, může se také rozpadnout. Učitelka ho na konci nenajde.
- Žádné `display:none` ani `.no-print` blok učitele neskrývají.

## 4. Nejmenší oprava (návrh, čeká na schválení)
1. **Dělení na stránky** (`worksheet-pdf-export.ts`): blok `.ws-teacher-block` nebo samostatný `.ws-answer-key` po rozdělení úloh přesunout na **novou poslední stránku** (případně na více stránek). Když je klíč dlouhý, dělit ho po řádcích `.ws-key-item` stejným měřením jako úlohy. Výsledek: klíč je v náhledu i v tisku vždy na konci a na samostatné stránce.
2. **Náhled v liště** (`WorksheetEditor.tsx` ř. 2795): použít stejné HTML jako exportní náhled, tedy `buildWorksheetPdfBlobUrl` s aktuálními volbami z exportu. Druhá možnost je ponechat žákovskou verzi a výslovně ji tak označit. Doporučuji první variantu, aby se volby nikde nelišily.
3. **Písmeno u výběru z možností** (`renderAnswerKey`): pokud se ukládá text, dohledat pořadí možnosti a vypsat „B) text“. Bodování ani data se nemění.
4. **Testy** (`src/test/student-worksheet-pdf.test.ts` nebo nový soubor):
   - HTML učitelské verze obsahuje `ws-teacher-block`, „Klíč odpovědí“ a u výběru z možností správné písmeno.
   - Skript dělení přesouvá blok učitele na poslední stránku. Ověří se v DOM test: po rozdělení je `.ws-teacher-block` v posledním `.ws-page`.
   - Žákovská verze neobsahuje `ws-key-item` ani `ws-teacher` (stávající test zůstává).
   - Stávající testy hustoty tisku a výšky řádků tabulky zůstávají beze změny.

## 5. Migrace
Není potřeba. Mění se jen vzhled a pořadí stránek v tisku. Data, oprávnění, bodování ani demo ochrany se nemění.

## Rizika
- U učitelské verze přibude jedna stránka na konci, protože klíč začne vždy na nové stránce. Žákovská verze se nezmění.
