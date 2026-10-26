
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
