
---

# Část F – Rozložení sešitu na tabletu (diagnostika + návrh, bez DB)

## F.a Zjištění z kódu
- **Náhled bez obrázku listu je záměr:** `src/components/notebook/NotebookPageThumb.tsx:13` („kresba (bez obrázků)“), řádky 30–31 kreslí jen `content.strokes` a `content.textBoxes`; `content.images` (obrázek A4 stránky listu „pro pero“) se do miniatury nekreslí. Proto je náhled bílý s pár tahy.
- **Proč je náhled obří:** `src/pages/MyNotebook.tsx:549` – `grid gap-4 lg:grid-cols-[180px_1fr]`. Pod 1024 px šířky okna (Tailwind `lg`) se sloupec „Stránky“ skládá NAD editor a miniatura má `w-full` + poměr A4 (`NotebookPageThumb.tsx:35-36`), tedy přes celou šířku (~1300×1900 u širokého okna bez gridu). Seznam `space-y-2` (ř. 557) řadí miniatury svisle, takže editor (Název stránky ř. 611, Oddíl ř. 621, Podklad ř. 672, nástroje) je až pod všemi miniaturami.
- **iPad:** `lg` se řídí šířkou okna, ne zařízení. iPad na šířku (1366/1390) a na výšku 1024 by měl dostat sloupec; na výšku u iPadu 10,9" (820 px), v Split View nebo při zvětšení písma v Safari je okno < 1024 → obří náhled. Které z toho nastalo u učitelky, není potvrzené; ověří se měřením v kroku F.d.

## F.b Návrh rozložení
- **Pod `xl` (1280 px) i pod `lg`:** editor hned nahoře; nad ním vodorovný posuvný pruh miniatur (šířka 96–112 px, číslo stránky, aktivní orámovaná `border-primary`, automaticky odroluje na aktivní). Přidat stránku = malé tlačítko na konci pruhu. Duplikovat/Smazat přes menu „⋯“ u aktivní miniatury.
- **Od `xl`:** zachovat dnešní levý sloupec 180 px.
- **Miniatura s obrázkem listu:** `NotebookPageThumb` dostane volitelné vykreslení `content.images` (obrázek pod tahy), načítané líně (`loading="lazy"`/IntersectionObserver) jako `<img>` pod canvasem – bez změny uložených dat a bez vlivu na exporty.
- **Panel nástrojů sticky** (`sticky top-0 z-10 bg-background`) při scrollu.
- **„Název stránky / Oddíl / Podklad“** sbalit do jednoho řádku „Nastavení stránky“ (Collapsible, výchozí sbaleno na tabletu, rozbaleno na PC).
- Předchozí/Další zůstávají u editoru.

## F.c Rizika a co nerozbít
- Uložený formát (`content.strokes`, `pressures`, `textBoxes`, `images`) se nemění; export PDF, portfolio a náhledy v portfoliu (`MyNotebook.tsx:773`) dál kreslí stejnou funkcí – obrázek v miniatuře jen jako samostatná vrstva `<img>`, sdílený renderer exportu se nemění.
- Přetahování pořadí stránek (drag, ř. 559–563) zachovat v pruhu i sloupci; přesouvat jen myší, na dotyku nekolidovat se scrollem pruhu.
- Paměť iPadu: miniatury s obrázkem jen líně a malé; žádné celoplošné obrázky v pruhu.
- Digitální listy (`mode === "digital"`) – ikona s názvem zůstává.
- Demo ochrany, DB, RLS beze změny. Migrace není potřeba.
- Testy: miniatura vykreslí obrázek pod tahy; pod 1280 px editor předchází miniaturám v DOM a pruh je vodorovný; nad 1280 px sloupec; Nastavení stránky sbalené/rozbalené; stávající testy sešitu a pera beze změny.

## F.d Jak testovat tablet
1. `lovable auth-session --json --self`, obnovit session, otevřít sešit „Mediální výchova“ (jen čtení, ukládání v testu blokovat přes `page.route` na zápis `notebook_pages`).
2. Profily: Chromium a WebKit (pokud je `playwright.webkit` dostupný, jinak jen Chromium) – iPad 820×1180, 1024×1366, 1366×1024, 1390×1900; `hasTouch`, `isMobile`, UA iPad Safari.
3. Screenshoty PŘED a PO (viewport + výřez oblasti stránek), měření: šířka miniatury, pozice editoru (`boundingBox().y`), zda je v miniatuře obrázek.
4. Pero: CDP `Input.dispatchTouchEvent` / syntetické `PointerEvent` s `pointerType:'pen'` a `pressure`; ověřit polohu tahu a že se nevybírá text.
- **Emulací nejde ověřit:** skutečný Apple Pencil (latence, tlak, palm rejection), Safari callout a lupa, Scribble, chování klávesnice iPadu, skutečná paměť/baterie.

## F.e Etapy
1. Měření (F.d, jen čtení) a zápis zjištění.
2. Rozložení pod `xl`: editor nahoře, vodorovný pruh, sticky nástroje, „Nastavení stránky“.
3. Miniatury s obrázkem listu (líně).

---

# Část G – Jeden model „pracovní list v sešitě“ (varianta 2 z Části C, etapy 3 + 4)

Stav: návrh, nic neimplementováno. Bez DB migrace (volitelná DB etapa G6 jen jako návrh).

## Výchozí stav (ověřeno v kódu)
- `src/lib/notebook.ts:55-63` – `content.worksheet = { worksheetId, mode: "digital"|"pen", title, assignmentId?, pageIndex?, pageCount? }`; parser `:125` zachová pole jen při `worksheetId` typu string.
- `src/lib/worksheet-notebook.ts:152-195` – `digital` vloží 1 odkazovou stránku; `pen` rasterizuje list (`renderStudentWorksheetPages`, html2canvas) do `notebook-media`.
- `src/pages/MyNotebook.tsx:716-729` – `mode === "digital"` → `NotebookWorksheetPage` (bez vrstvy pera), jinak `NotebookCanvas`.
- `src/components/notebook/NotebookWorksheetPage.tsx:94-130` – úkol → `WorksheetPanel kind="assignment"` (`assignment_attempts`, gate, lock po termínu), bez úkolu → `kind="own"` (`student_worksheet_work`).
- `src/components/notebook/InsertWorksheetButton.tsx:30-31,95` – volba „Digitálně“ / „PDF pro pero“, dedupe podle existujících stránek.

## 1. Datový model (bez migrace)
- Nový režim jen rozšířením typu: `worksheet.mode: "digital" | "pen" | "live"`. Stránka `live` = `{ worksheetId, mode:"live", title, assignmentId? }` + běžné `strokes`/`textBoxes` ve stejném `notebook_pages.content`.
- Souřadnice tahů: normalizované k šířce A4 kontejneru listu (x/y v logických px při referenční šířce 820 px, y roste s výškou listu), takže zoom i jiná šířka obrazovky tahy nezkreslí. Uloží se `inkRef: { width: 820 }` u stránky; formát `Stroke` beze změny.
- Odpovědi: úkol → `assignment_attempts` přes stávající `WorksheetPanel`/`student-assignment-attempts.ts`; bez úkolu → `student_worksheet_work` (draft per student+worksheet+variant). Do sešitu se odpovědi NEKOPÍRUJÍ (jediný zdroj pravdy).
- Autosave: odpovědi stávajícím autosave WorksheetPanelu; tahy stávajícím debounce `onContentChange` v MyNotebook. Dvě nezávislé cesty, žádné nové zápisy.
- Kompatibilita: `digital` a `pen` stránky se vykreslují přesně jako dnes. `digital` lze volitelně zobrazit jako `live` (stejná data odpovědí, jen přidaná vrstva) – rozhodnutí učitelky (otázka 1). Nic se nepřevádí ani nemaže automaticky.
- Riziko: starší klienti (cache PWA) neznají `live` → spadnou do větve `NotebookCanvas` a ukážou prázdnou stránku; ochrana: parser i starý kód zachovají tahy, po refreshi OK. Miniatura (`NotebookPageThumb.tsx:81`) musí `live` značit stejně jako `digital`.

## 2. Vykreslení
```text
<NotebookLiveWorksheetPage>        (relative, šířka A4 820 px × zoom)
  ├─ WorksheetPanel (z-0)          pole, výběr, P/N, doplňování, přiřazování, tabulky
  └─ InkOverlay (absolute inset-0, z-10)
       režim Psát: pointer-events:none  → vše jde do polí, prst scrolluje
       režim Pero: pointer-events:auto, touch-action:none jen pro pen;
                   touch = scroll (dle „Jen pero“), myš kreslí
```
- Overlay = `NotebookCanvas` ve „vrstvovém“ módu (průhledné pozadí, bez vlastního pozadí/miniatur, sdílené `renderStroke`, horní vrstva pro živý tah, zvýrazňovač/krytí, citlivost). Velikost plátna z `ResizeObserver` na kontejneru listu.
- Doporučení: JEDNA DLOUHÁ STRÁNKA bez vnitřního scrollu (scrolluje celá stránka sešitu). Vnitřní scroll + pero = konflikt gest a posun tahů. Stránkování na A4 kusy rozbije položky přes zlom a zarovnání tahů.
- Zoom sešitu (NotebookCanvas, 50–250 %) se aplikuje na celý obal (list + vrstva) jedním `transform`/šířkou, takže vrstva zůstane zarovnaná.
- Riziko: výška listu se mění (rozbalení vysvětlení, výsledky po odevzdání) → tahy „ujedou“. Mitigace: v sešitě zamknout layout (stejné položky, výsledky pod listem, ne mezi položkami) a ukotvit tahy k celkové výšce; test na posun.
- Zamčený úkol (po odevzdání/termínu): pole read-only jako dnes, pero také vypnuto (čtení), aby se odevzdaná práce neměnila.

## 3. Pero do textového pole
- Doporučení nejmenší spolehlivé varianty: nativní iPadOS Scribble – v režimu Psát jsou pole skutečné `input/textarea` s fontem ≥16 px (hotovo v Etapě 1 Části C), Scribble převede rukopis na text. Nic vlastního.
- V režimu Pero lze psát perem kamkoli včetně přes pole; tah se uloží jako běžný tah na vrstvě (vizuálně „u pole“), ale nehodnotí se. Učitel jej vidí jen u úkolu, pokud se tahy zobrazí v hodnocení (viz 5).
- Tlačítko „Psát perem“ u každého pole (ukládání tahu k poli) NEDOPORUČUJI v této etapě: nová datová vazba, složitost, riziko.

## 4. Postup vložení
- Dialog „Vložit pracovní list“ (`InsertWorksheetButton.tsx`): volby 1) „Vyplňovat v sešitě (doporučeno)“ = `live`, výchozí; 2) „Obrázek pro pero / PDF“ = stávající `pen`. Volba „Digitálně“ se nahradí `live` (pokud učitelka schválí).
- Cizí PDF/fotky dál přes obrázek + vrstva + textová pole + „Psát klávesnicí“ (beze změny).
- Dedupe: existující `digital`/`live` stránka listu → otevřít ji, ne vkládat znovu.
- Staré stránky: nic nemazat, nepřevádět; u `pen` stránek nenabízet automatickou náhradu, jen ruční „Vložit jako vyplnitelný“ (nová stránka vedle).

## 5. Zpětná vazba učiteli
- Úkol: odpovědi → stávající `WorksheetAttemptGrading` beze změny. Tahy z vrstvy učitel zatím nevidí (jsou v `notebook_pages`, RLS vlastníka). Volitelně v G4: při odevzdání přiložit snímek vrstvy existující cestou `attachPenPagesToAttempt` (worksheet-notebook.ts:225) – bez DB.
- Samostatný list bez úkolu: vidí jen žák (RLS beze změny).
- Volitelná DB etapa G6 (zvlášť, až po „schvaluji“): `student_worksheet_work` SELECT pro učitele žákovy třídy/skupiny přes SECURITY DEFINER helper; SQL+rollback připravím samostatně po diagnostice RLS, nyní nenavrhuji konkrétní SQL.

## 6. Učebnice → sešit
- `src/components/lesson/LessonWorksheets.tsx`: u listu tlačítko „Otevřít v sešitě“ (jen žák, ne demo seed náhled): `ensure_my_course_notebooks()` → najít sešit podle `subject_id`/třídy → `insertWorksheetIntoNotebook(mode:"live")` (idempotentní) → přejít na stránku.
- Sešit k předmětu neexistuje (žák není ve třídě/skupině předmětu, učebnice bez `subject_id`): dialog s výběrem existujícího sešitu nebo „Vytvořit nový sešit“ (stávající `createNotebook`). Nikdy nevytvářet sešit automaticky mimo `ensure_my_course_notebooks()`.

## 7. Etapy (každá samostatně nasaditelná)
| Etapa | Obsah | Odhad |
|---|---|---|
| G1 | Typ `live`, parser, miniatura, render `live` = WorksheetPanel bez vrstvy (feature parity s digital) | 3 h |
| G2 | InkOverlay nad listem, přepínač Psát/Pero, pointer/touch-action, zoom, zarovnání při změně výšky | 8 h |
| G3 | Dialog vložení (výchozí live), dedupe, ruční „Vložit jako vyplnitelný“ | 3 h |
| G4 | Zámek po odevzdání, volitelný snímek vrstvy k odevzdání | 4 h |
| G5 | „Otevřít v sešitě“ z učebnice + fallback výběru sešitu | 4 h |
| G6 | (volitelně, DB) náhled samostatných prací učitelem | po diagnostice |

Testy: jednotkové – parser `live`/staré stránky beze změny, normalizace souřadnic při zoomu/šířce, přepínač mění pointer-events, dedupe vložení, výchozí volba dialogu, fallback sešitu. Playwright Chromium+WebKit 820×1180 hasTouch: vložení listu, psaní do pole, pen eventy kreslí, touch scrolluje, Psát režim neblokuje pole, tah zůstane na místě po zoomu a reloadu; zápisy `[TEST]` jen do agentem vytvořených dat, poté úklid.
Emulace neověří: Apple Pencil tlak/naklonění, Scribble, palm rejection, výkon dlouhého listu na iPadu, Safari paměť.
Demo: žádné nové zápisy mimo existující tabulky; demo RESTRICTIVE politiky platí beze změny; v demo seed náhledu učebnice tlačítko skrýt.
NEDĚLAT: měnit formát tahů, hodnocení, RLS, `assignment_attempts` schéma, mazat/převádět staré stránky, ukládat odpovědi do sešitu, publikovat.

## Otázky pro učitelku
1. Mají se stávající stránky „Digitálně“ automaticky zobrazovat jako vyplnitelné s perem (bez změny dat), nebo zůstat jak jsou?
2. Má učitel u úkolu vidět i čmáranice perem (snímek přiložený k odevzdání), nebo jen odpovědi v polích?
3. Má po odevzdání úkolu zůstat pero zamčené, nebo smí žák dál psát poznámky (neodevzdané)?
