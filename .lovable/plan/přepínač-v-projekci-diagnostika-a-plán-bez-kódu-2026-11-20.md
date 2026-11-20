# Přepínač v projekci – diagnostika a plán (bez kódu)

Po schválení se plán uloží také do `.lovable/plan/projekce-prepinac-2026-11-20.md`. Nic se nenasazuje, žádná změna databáze.

## 1. Co projekce umí dnes (ověřeno v kódu)

**Okno projektoru `/live/projektor/:sessionId` (LiveProjectorScreen)**
- Plovoucí lišta vpravo nahoře, která se po 3 s nečinnosti skryje (`useIdleChrome`): Zmenšit/Zvětšit/zoom %, velikost písma, „Kód vždy viditelný“, Celá obrazovka, Zavřít.
- „Zavřít“ okno zavře (pokud bylo otevřeno z učitele), jinak jde zpět v historii.
- Klávesy jen `+`, `-`, `0` (zoom). Šipky, Esc (kromě vestavěného opuštění celé obrazovky prohlížečem) ani číslice nic nedělají.
- Projektor jen zobrazuje stav jednoho živého sezení; sám nepřepíná slidy. Umí zobrazit tabuli (`whiteboard_data`), kterou zapíná učitel.
- Nástroje do hodiny (odpočet, stopky, losování, skupiny, megatext, hlasitost) na projektoru **nejsou**.

**Učitelská obrazovka `/live/ucitel/:sessionId` (LiveTeacherScreen)**
- Otevírá projektor jako **nové okno** (`window.open`), ovládá slidy, tabuli („Živá tabule“), menu „Nástroje“ (adaptivní otázky aj.), plán hodiny s tempem (`LessonPlanPacing`), odchod „Zpět do učebnice“.
- Klávesové ovládání slidů zde v kódu nenalezeno.

**Ovladač z telefonu `/prezentace/ovladani/:sessionId` (PresenterRemote)**
- Předchozí / Pauza–Pokračovat / Další / Ukončit, swipe. Nic dalšího (tabule, nástroje, přepnutí obsahu).

**Prezentace i hra** se spouštějí jako samostatné živé sezení (`game_sessions`); jedno okno projektoru = jedno sezení. Paralelní „prezentace + hra“ v jednom okně dnes neexistuje.

**Nástroje do hodiny** (`/ucitel/nastroje`, `ClassroomToolsOverlay`) běží jen lokálně v okně, kde jsou otevřené; stav se nesdílí mezi okny.

**Kde dnes učitel projekci opouští:** chce-li nástroj (musí do `/ucitel/nastroje` nebo jiného okna), chce-li přepnout prezentace ↔ hra (zavřít projektor, spustit nové sezení, otevřít nový projektor), chce-li zpět na lekci/učebnici, nebo jinou aplikaci (Alt+Tab – mimo naši aplikaci, nelze řešit webem).

## 2. Návrh: jeden plovoucí přepínač v projekci

Malé tlačítko „Přepnout“ ve stávající skrývací liště projektoru (stejné chování: ukáže se po pohybu myši, klepnutí nebo klávese, skryje se po ~3 s). Otevře nabídku:

| Položka | Dnes možné? | Co je potřeba |
|---|---|---|
| Nástroje do hodiny jako vrstva nad projekcí | Ano, lokálně | Vykreslit `ClassroomToolsOverlay` v okně projektoru (portál do celé obrazovky už existuje); bez DB |
| Tabule zapnout/vypnout | Ano | Volat existující `toggle_game_whiteboard` (jen učitel přihlášený v okně) |
| Návrat do přehledu (učitelská obrazovka / učebnice) | Ano | Pouze navigace; u druhého monitoru raději „přepnout na učitelské okno“ = nelze (prohlížeč nedovolí zaměřit jiné okno spolehlivě) |
| Prezentace ↔ hra (dvě sezení) | Částečně | Výběr z učitelových **běžících** sezení a přepnutí projektoru na jiné `sessionId` ve stejném okně, celá obrazovka zůstane. Potřebuje seznam aktivních sezení (čtení, ověřit RLS) |
| Hra uvnitř prezentace současně | Ne | Nový stav sezení; samostatná etapa jen po schválení, pravděpodobně DB |
| Jiná aplikace (Word, video…) | Ne | Webová stránka nemůže přepínat systémová okna; jen návod (Win+P / Alt+Tab) |

**Dvě okna (projektor jako druhý monitor):** učitelské okno zůstává hlavní ovladačem. Aby přepínání fungovalo z obou míst, přepnutí obsahu (tabule, případně nástroj či cílové sezení) musí jít přes sdílený stav: buď existující nastavení sezení (bez nové tabulky, např. `settings.projectorOverlay`), nebo `BroadcastChannel` mezi okny stejného prohlížeče (bez DB, nefunguje z telefonu). Rozhodnutí závisí na odpovědích Tyny.

## 3. Klávesy a telefon

- Existuje: projektor `+ − 0`; telefon prev/pauza/next/konec.
- Chybí (návrh): v projektoru šipky/PageUp/PageDown (prezentéry „klikátka“ posílají právě tyto klávesy) → přes stejnou akci jako ovladač; `T` tabule; `N` nástroje; číslice 1–6 rychlý výběr nástroje jen při otevřené nabídce; Esc zavře nabídku (opuštění celé obrazovky řídí prohlížeč). Šipky v projektoru vyžadují přihlášeného učitele v tom okně – ověřit.
- Telefon: přidat tlačítka „Tabule“, „Odpočet“, „Losování“ a výběr běžícího sezení; nástroje by se pak musely sdílet přes stav sezení (nikoli lokálně) – citlivé na soukromí jmen při losování.

## 4. Etapy

0. Upřesnění s Tynou (otázky níže). Bez kódu.
1. Projektor: tlačítko „Přepnout“ + nástroje do hodiny jako lokální vrstva + tabule + šipky/klikátko. Bez DB.
2. Přepnutí na jiné běžící sezení ve stejném okně při zachování celé obrazovky. Bez DB, pokud čtení sezení stačí stávající RLS.
3. Ovladač z telefonu: tabule, nástroje, přepnutí sezení (sdílený stav; pokud vyžaduje DB, přesné SQL a zastavit na schválení).
4. (Volitelně) Prezentace a hra v jednom sezení – jen po samostatném plánu.

## Rizika
- Losování jmen na projektoru: dodržet stávající ochranu jmen.
- Klávesy nesmí kolidovat se zoomem ani se vstupy žáků/odpověďmi.
- Projektor bez přihlášení (sdílený odkaz) nesmí získat ovládání – akce jen pro učitele sezení.
- Přepnutí sezení nesmí ukončit běžící hru ani časovač.

## Testy
- Skrývání/zobrazení přepínače (pohyb, klávesa, klepnutí), mapování kláves, že `+ − 0` zůstanou, oprávnění (nepřihlášený projektor nevidí ovládací položky), přepnutí sezení nemění stav hry; regrese live-game-core, game-session-sync, live-timing.
- **Nelze ověřit bez živého testu:** skutečný projektor/druhý monitor, chování celé obrazovky v různých prohlížečích, USB klikátko, telefon jako ovladač ve školní síti.

## Otázky pro Tynu
1. Mezi čím přesně potřebujete přepínat: prezentace ↔ hra ↔ nástroje (odpočet, losování) ↔ tabule? Potřebujete i jinou aplikaci (Word, video)?
2. Používáte projektor jako druhý monitor (dvě okna)? (ano/ne)
3. Ovládáte hodinu hlavně z počítače (ano) nebo z telefonu (ne)?
4. Používáte bezdrátové klikátko na slidy? (ano/ne)
5. Stačí, když se nástroj (např. odpočet) zobrazí přes promítaný obsah a pak se zavře? (ano/ne)
