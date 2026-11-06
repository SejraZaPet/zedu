# Lišta „Prohlížíš jako“ a čitelnost projekce – diagnostika a návrh

Jen diagnostika. Žádný kód, žádná změna databáze, nic se nenasadilo.

## A) Plovoucí lišta „Prohlížíš jako Učitel × Zpět na admina“

### Kde je a jak se řídí viditelnost
- Komponenta je `src/components/ViewAsBanner.tsx`. V `src/App.tsx` (ř. 121) se vykresluje globálně nad **všemi** stránkami, tedy i nad projektorem, živou hrou a prezentací.
- Lišta je vidět, když `realRole === "admin"` a `viewAsRole` je jiná role než admin. Na adrese stránky nezáleží, celoobrazovkový režim nijak nezohledňuje.
- Pozice je `fixed bottom-4 left-1/2 -translate-x-1/2 z-50`, tedy **uprostřed dole**. Uvnitř je text „Prohlížíš jako **Učitel**“ a tlačítko „Zpět na admina“.
- Lišta navíc nastaví `document.body.style.paddingBottom = 4.5rem`. Na projektoru, kde je stránka přes celou výšku (`min-h-screen`), tím vzniká posun obsahu nebo posuvník.

### Proč vypadá na každém zařízení jinak
- Lišta nemá `whitespace-nowrap` ani omezení šířky. Na úzkém telefonu se text i tlačítko zalomí do 2–3 řádků a lišta zakryje obsah (Dnes, úkoly).
- Nezohledňuje bezpečnou oblast iPhonu (spodní lištu Safari).
- Na PC má plnou velikost písma `text-sm` a je posazená uprostřed, takže překrývá patičku.
- Na projekci stojí uprostřed dole přímo nad snímkem.

### Návrh (jen frontend)
1. **Jedna kompaktní podoba všude:** jednořádková pilulka **vpravo dole** (`whitespace-nowrap`, `max-w` podle šířky obrazovky).
   - Na telefonu jen ikona oka a „Zpět“; popis „Prohlížíš jako Učitel“ bude jako `aria-label` a tooltip.
   - Spodní odsazení bude počítat s bezpečnou oblastí iPhonu (aspoň 5rem nad lištou Safari), stejně jako pilulka testovacího žáka. Obě pilulky se nebudou překrývat, druhá se posune výš.
2. **Ruční úprava odsazení stránky odpadne.** `body.paddingBottom` lišta nebude nastavovat, protože je malá a v rohu.
3. **Projekční a celoobrazovkové stránky:** na `/live/projektor/*`, v živé hře, v promítání lekce a prezentace a v režimu celé obrazovky (`document.fullscreenElement`) se zobrazí jen **miniaturní ikona 32 px** v pravém horním rohu. Bude průsvitná, plně viditelná při najetí myší nebo zaměření klávesnicí a bude mít tooltip „Zpět na admina“.
   - Ikona se po 3 s nečinnosti skryje spolu s ostatním ovládáním (viz B3).
   - Seznam těchto stránek bude v jednom místě (`isPresentationRoute(pathname)`).
4. **Návrat na admina zůstane vždy dostupný:** ikonou i přes menu „Přepnout roli“, které už je nasazené. Klik bude dělat přesně to co dnes: `setViewAsRole(null)` a přechod na `/admin`.

## B) Projekce `/live/projektor/<id>` – proč je snímek malý

### Jak se snímek dnes škáluje (`src/components/live/ProjectorSlideView.tsx`)
1. **Vnější scéna** 1600×900 px se zmenší na okno (`scale = min(šířka/1600, výška/900)`, ř. 116–120).
2. **Uvnitř scény** zabírá místo pevné „ovládání“:
   - progress lišta (8 px),
   - šedá hlavička s názvem a „Snímek 3/32“ (ř. 214–217, zhruba 80 px),
   - okraje `px-6 py-4`,
   - patička „Kód: …“ a „12 žáků online“ (ř. 300–303, zhruba 90 px).
3. **Vnitřní scéna** `ProjectorCanvasStage` (ř. 22–70) je **znovu** 1600×900 a znovu se zmenší, tentokrát do zbylého prostoru (asi 1550×700, ř. 43).

Následek: snímek se zmenšuje **dvakrát**. Výška snímku je asi 78 % okna, a protože vnitřní zmenšení řídí výška, je stejně úzký i do šířky. Na oknech jiného tvaru než 16:9 (16:10, notebook se záložkami) navíc přibydou okraje kolem.

### Proč nepomáhá zvětšení v prohlížeči
Měřítko se počítá z rozměrů okna. Když prohlížeč zvětší, okno má v CSS pixelech méně místa, výpočet měřítko o stejný poměr zmenší a výsledná velikost zůstane stejná. Ovládání velikosti písma, A−/A+ ani „Vyplnit plochu“ neexistuje. Na projektoru je jen tlačítko „Zavřít“ (`LiveProjectorScreen.tsx` ř. 45).

### Proč tabulka nezaplní prostor
Tabulka je blok uvnitř `SlideCanvas` s pozicí a velikostí písma z editoru (souřadnice 1600×900). Nikdy není větší, než ji autor nakreslil v editoru, a k tomu se zmenšuje dvojím škálováním výše. Rozvržení snímku je záměrně shodné s editorem; dle pravidla projektu se pozadí snímku vždy centruje na scénu 16:9.

### Rušivé prvky
- Hlavička s názvem a „Snímek X/Y“ a patička s kódem a počtem žáků jsou vidět stále.
- Pod nimi je volitelný pruh s tabulí (ř. 252) a tlačítko „Zavřít“.
- Nad tím vším je lišta „Prohlížíš jako“ uprostřed dole (viz A).

### Návrh (jen frontend, bez DB)
1. **Snímek přes celou plochu (fit to viewport):**
   - Odstranit dvojí škálování. Snímek se zmenší **jen jednou**, přímo na okno.
   - Hlavička a patička se přesunou do vlastní **překryvné vrstvy** nad snímkem a nebudou ubírat jeho plochu.
   - Snímek tak vyplní 100 % šířky nebo výšky okna místo dnešních asi 78 %.
   - Rozvržení snímku zůstane shodné s editorem.
2. **Velikost A− / A+ / „Vyplnit plochu“:**
   - Malé ovládání v překryvné vrstvě: přiblížení snímku 100–150 % po 10 %, se středem uprostřed, aby se okraje nevešly a obsah vyplnil plochu. Plus tlačítko „Přizpůsobit obrazovce“ (zpět na 100 %).
   - Klávesy `+` / `-` / `0`.
   - Volba se uloží pro dané zařízení (localStorage) a databáze se nemění.
   - Nebude to kolidovat s existujícím přibližováním zón (`zoomStageStyle`), které učitel ovládá na dálku: jde o dvě oddělené vrstvy.
   - Volitelně tlačítko „Celá obrazovka“ (`requestFullscreen`).
3. **Režim „Čistá projekce“:**
   - Hlavička, kód, počet žáků, Zavřít, A−/A+ a ikona Zpět na admina se po **3 s bez pohybu myši** skryjí plynulým zprůhledněním.
   - Znovu se zobrazí při pohybu myši, dotyku nebo klávese.
   - Progress lišta (tenká) zůstane.
   - Kód pro připojení zůstane vždy v úvodní obrazovce s QR kódem, ta se nemění.
   - Respektovat `prefers-reduced-motion`; při zaměření klávesnicí se ovládání neskrývá.
4. **Minimální čitelnost:** tabulky a texty ve `SlideCanvas` se nemění, protože by to rozbilo shodu s editorem. Čitelnost z posledních lavic zajistí body 1–2. Upozornění na příliš malé písmo v editoru je možné jako budoucí krok, není součástí návrhu.

## Soubory
- `src/components/ViewAsBanner.tsx`: kompaktní podoba, roh, bezpečná oblast, režim ikony.
- Nový `src/lib/presentation-routes.ts`: `isPresentationRoute()` a test.
- `src/components/live/ProjectorSlideView.tsx`: jedno škálování, překryvná vrstva ovládání, A−/A+.
- Nový `src/hooks/useIdleChrome.ts`: skrývání po 3 s.
- `src/pages/LiveProjectorScreen.tsx`: tlačítko Zavřít do překryvné vrstvy.

## Rizika
- Změna škálování projektoru se dotkne všech typů snímků: aktivity, MCQ, nástěnka, word cloud, týmy, únikovka, závod, tabule. Překryv tabule (`LiveWhiteboard`) musí sedět na stejné souřadnice jako snímek, jinak se tahy posunou. **Kritické k otestování.**
- Na projektoru se nesmí změnit časování, bodování ani synchronizace snímků. Měníme jen vzhled.
- Skrytý kód pro připojení: pozdní příchozí žák ho uvidí po pohybu myši. Lze přidat přepínač „Kód vždy viditelný“.
- Lišta pro admina nesmí zmizet úplně: ikona plus menu „Přepnout roli“.

## Testy
- Vitest:
  - `isPresentationRoute` (projektor, hra, lekce ano; Dnes, úkoly ne).
  - `ViewAsBanner`: na projekci jen ikona s `aria-label` „Zpět na admina“; klik volá `setViewAsRole(null)`; mimo admina se nevykreslí.
  - `useIdleChrome`: skrytí po 3 s, zobrazení při pohybu, neskrývá se při zaměření.
  - Výpočet měřítka a přiblížení (hranice 100–150 %, uložení a obnova, chyba localStorage).
- Playwright: 1920×1080, 1440×900 (16:10) a 390×844. Snímek vyplní šířku nebo výšku, lišta je jednořádková a v rohu. Jen na vlastní ukázkové relaci `[TEST]`, bez skutečných tříd a bez přihlašování za žáky.

## Zakázáno bez dalšího souhlasu
DB/RLS, změny her nebo bodování, úpravy obsahu snímků, deploy.
