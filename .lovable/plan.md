# Plán: diagnostika a oprava regrese tabulky "Přední čtvrť / Zadní čtvrť"

## Cíl
Vrátit detekci legitimní 2×7 tabulky, aniž bychom znovu propustili false-positive z minulého kola (rozsypaná 10-sloupcová "tabulka" u vnitřností).

## Fáze 1 — Naměřit reálná data (bez změny thresholdů)

V `supabase/functions/process-file-content/index.ts` v `extractSlideText()`:

1. Přidat `console.log("[pptx-table-diag]", { slideShapes: shapes.length, rowSizes: rows.map(r => r.length) })` po zclusterování řádků.
2. Uvnitř `while (i < rows.length)` logovat pro každý `canStart=false` důvod:
   - `cols` mimo 2–5,
   - prázdné buňky,
   - `widthCV = stdev/mean` když spadne test uniformity.
3. Když group.length < 2, logovat, který test u `next` selhal (`length mismatch`, `empty cell`, `widthCV`, `x-align drift@col=k=Δ`).

Uživatelka reimportuje PPTX. V `edge_function_logs` uvidíme přesně, který test u řádku s "PŘEDNÍ ČTVRŤ / ZADNÍ ČTVRŤ" padl a s jakou konkrétní hodnotou.

## Fáze 2 — Cílená oprava (podle toho, co ukáže Fáze 1)

Aplikovat jen relevantní úpravu, ne všechny najednou:

**A. yTolerance mis-clustering** → přejít z absolutní tolerance od `last[0].y` na test vertikálního překryvu boxů: `overlap(a, b) = min(cy_a, cy_b) * 0.6`. Robustní vůči heterogenním výškám (velká hlavička + úzké tělo).

**B. `rowWidthsUniform` falešný negativ na hlavičce** → pro `cols === 2` uvolnit `WIDTH_CV_MAX` na 0.55, nebo úplně přeskočit test šířky na **prvním** řádku group a vyžadovat ho jen u těla.

**C. Native `<a:tbl>` mimo scope** → přidat samostatnou větev před shape-scan: najít `<p:graphicFrame>` s `<a:tbl>`, iterovat `<a:tr>`/`<a:tc>`, emitovat markdown tabulku deterministicky bez heuristiky. Toto je nejčistší cesta, pokud autor slidu použil skutečnou PowerPoint tabulku.

**D. `X_ALIGN_TOL` moc přísný** → tolerance relativní k šířce sloupce: `tol = max(200000, base[k].cx * 0.15)`.

## Fáze 3 — Ověření

1. Uživatelka reimportuje PPTX "Hovězí maso".
2. Ověřit v DB (`textbook_lessons`), že:
   - vznikla korektní tabulka **Přední čtvrť / Zadní čtvrť** (2×7),
   - slide s vnitřnostmi (líčka/játra/srdce...) je odstavcový text, **ne** 10-sloupcová tabulka.
3. Odstranit diagnostické `console.log` z Fáze 1.

## Co v tomto plánu **není**
- Slepá úprava thresholdů bez naměřených dat — v předchozím kole nás to dostalo do oscilace mezi false-positive a false-negative.
- Změny mimo `extractSlideText()`.

## Technická poznámka
Fáze 1 je čistě aditivní logování (žádná změna chování). Rollback = odstranit tři `console.log` řádky.
