# Část E – Sešit na iPadu: poslední stránka, výběr textu při psaní perem, citlivost pera

Diagnostika z kódu a databáze. Nic není změněno. Měření v Chromiu s emulací pera proběhne jako první krok implementace (není zatím provedeno).

## 1) „Sešit musí mít alespoň jednu stránku“
- Pravidlo je **jen v aplikaci**: `src/pages/MyNotebook.tsx:300` (`deletePage`: `if (pages.length <= 1) return toast.error(...)`).
- V databázi žádné takové pravidlo není: na `notebook_pages` je jen trigger `update_notebook_pages_updated_at` (ověřeno dotazem).
- Důvod existence: sešit bez stránky by neměl aktivní stránku (`activePage = pages[activeIndex] ?? null`, `MyNotebook.tsx:202`) a plátno by nebylo kde zobrazit.
- Návrh: smazání poslední stránky povolit tak, že se po smazání automaticky vytvoří nová prázdná stránka (stejná cesta jako „Přidat stránku“, `MyNotebook.tsx:~285-296`). Potvrzení: „Smazat poslední stránku? Sešit dostane novou prázdnou stránku.“ Pořadí: nejdřív vytvořit prázdnou, pak smazat starou (při chybě se nic neztratí). Hláška zmizí.

## 2) Výběr/zvýraznění obsahu a iOS menu při psaní perem
- Kreslicí plocha `NotebookCanvas.tsx:503-511` má jen `touch-none`. Chybí `user-select:none`, `-webkit-user-select:none`, `-webkit-touch-callout:none`, `-webkit-tap-highlight-color:transparent` (žádný výskyt v `src/components/notebook`, `MyNotebook.tsx`, `index.css`).
- Obrázek listu už má `select-none` a `draggable={false}` (`NotebookImageContent.tsx:96`), ale Safari vybírá okolní text (nadpisy, popisky stránky) a obal obrázku; dlouhý stisk pera spustí výběr a menu Kopírovat/Vyhledat/Přeložit.
- Stage nemá `onContextMenu` ani `onSelectStart`.
- Návrh (jen v kreslicích režimech pero/zvýrazňovač/guma/tvary, ne v režimu Text ani v textových polích):
  - třída na stage: `select-none [-webkit-user-select:none] [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent]`, `touch-action:none` zůstává,
  - `onContextMenu` a nativní `selectstart` → `preventDefault()`, pokud cíl není `input/textarea/[contenteditable]`,
  - v `onPointerDown` při kreslení `e.preventDefault()` (zamezí Scribble a výběru), opět mimo textová pole,
  - `draggable={false}` i na ostatních `img` uvnitř stage.

## 3) Citlivost pera
Zjištěno:
- `getCoalescedEvents()` se používá (`NotebookCanvas.tsx:205-216`); `getPredictedEvents()` ne; `pointerrawupdate` ne.
- Vykreslení: `renderStroke` (`src/lib/notebook.ts:146-184`) kreslí rovnými úsečkami `lineTo`, bez vyhlazení. S tlakem kreslí každou úsečku jako samostatnou cestu s jinou šířkou (`:171-178`) – viditelné „zuby“ a hranatost.
- Tlak: `pressureOf` (`NotebookCanvas.tsx:128-133`) – jen pero, rozsah šířky 0,5–1,5× základu; nulový tlak (vznášení) = 0,5.
- Minimální vzdálenost bodů: žádná – ukládají se všechny vzorky (velká data, pomalé vykreslování dlouhých tahů).
- Výkon: každý `pointermove` volá `rerender()` (`:53,219`) → React překreslí celou komponentu a efekt `:96-107` smaže a **znovu nakreslí všechny tahy stránky** na plátno velikosti stránka × DPR (na iPadu ×2). Na stránce s mnoha tahy to způsobuje zpoždění. Kontext není `desynchronized`.
- Ukládání: `onContentChange` (`MyNotebook.tsx:205-219`) volá po každém dokončeném tahu `setPages` nad celým sešitem a po 800 ms síťové uložení – neblokuje kreslení, ale překreslí stránku.
- Dlouhé oblouky mimo místo psaní (pravděpodobné příčiny, k ověření měřením):
  1. **Dlaň začne tah:** dotyk prstem/dlaní smí kreslit, pokud pero ještě nekreslí (`shouldIgnorePointer`, `:136-143`, ochrana jen 1 s po peru). Dlaň položená před perem vytvoří tah, pero pak „není přijato“ branou, takže tah dlaně pokračuje podle pohybu dlaně.
  2. **Přerušení iOS gestem/výběrem:** když Safari spustí výběr nebo menu (bod 2), přijde `pointercancel`; tah se ukončí, ale další vzorky mohou přijít s posunutými souřadnicemi.
  3. Změna velikosti během tahu (`ResizeObserver`, `:92`) přepočítá plátno, souřadnice tahu jsou ale relativní (0–1), takže to oblouky nevysvětluje.
  `setPointerCapture` se používá (`:180`), pohyb mimo plochu tedy příčinou není.

Návrh:
- **Režim pera:** přepínač v panelu „Kreslit: Pero / Prst“. Výchozí na dotykovém zařízení s perem (po prvním `pointerType==='pen'` se zapamatuje v localStorage): kreslí jen pero, prst posouvá stránku, dlaň nekreslí nikdy. Myš kreslí vždy.
- **Vyhlazení:** vykreslování středovými kvadratickými křivkami (`quadraticCurveTo` přes středy bodů) a u tlaku proměnná šířka plynule (krátké překrývající se segmenty se zaoblením, nebo vyplněný obrys). Starší uložené tahy se vykreslí stejnou funkcí, data se nemění.
- **Tlak:** rozsah šířky 0,35–1,6×, vyhlazení tlaku (klouzavý průměr ze 3 vzorků).
- **Výkon:** během tahu kreslit jen nový úsek na samostatnou horní vrstvu (druhé plátno), celé plátno překreslit až po dokončení tahu; bez `rerender()` při každém pohybu. Kontext s `{ desynchronized: true }`, kde je podporován. Předpovězené body (`getPredictedEvents`) jen dočasně na horní vrstvě, neukládat.
- **Ředění bodů:** neukládat bod bližší než ~0,6 px od předchozího (na úrovni zobrazení).
- **Citlivost/vyhlazení pera** v panelu: Jemné / Střední (výchozí) / Silné – mění míru vyhlazení a ředění; uloženo v localStorage.

## Co nerozbít
- Uložené tahy (`content.strokes`, `pressures`) zůstávají ve stejném formátu; mění se jen vykreslení.
- Export PDF, portfolio a náhledy používají `renderStroke` – po změně musí dát stejný tvar jako obrazovka (test).
- Textová pole a režim Text dál umožňují výběr textu a klávesnici.
- Demo ochrany, RLS a ukládání beze změny. Migrace DB **není potřeba**.

## Etapy
1. Výběr/menu iOS (bod 2) + smazání poslední stránky (bod 1). ~1 h.
2. Režim Pero/Prst + vyhlazení + tlak + ředění. ~2–3 h.
3. Výkon (horní vrstva, bez překreslování všech tahů, predikované body) + volba citlivosti. ~2 h.

## Testy
- Smazání poslední stránky vytvoří novou prázdnou a při chybě vytvoření nic nesmaže.
- `contextmenu`/`selectstart` se blokují v kreslicím režimu, v textovém poli ne.
- V režimu Pero dotyk nezačne tah; myš ano; dlaň před perem tah nevytvoří.
- Vyhlazení: tah z bodů v pravém úhlu se vykreslí křivkou (`quadraticCurveTo` volán), staré tahy bez `pressures` se vykreslí.
- Ředění: body bližší než práh se neukládají, ťuknutí perem stále dá tečku.
- Playwright (Chromium, 1390×1900, `hasTouch`): syntetické `pointerType: "pen"` s tlakem – poloha tahu, žádný výběr textu (`window.getSelection()` prázdná), počet překreslení během tahu.

## Neověřeno
- Skutečné chování Safari na iPadu (callout, Scribble, odmítání dlaně) – v Chromiu nelze věrně napodobit.
- Příčina dlouhých oblouků je odvozena z kódu, ne z měření na zařízení.
