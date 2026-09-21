# Prezentace z lekce: věrnější vizuál + oprava velikosti písma

Návrh k odsouhlasení. Porovnáno na lekci **Úvod maso** (učebnice Technologie, 25 bloků: 3 texty/callout, 15 spojených karet „slide_group", 2 tabulky uvnitř karet, 3 aktivity, 3 oddělovače).

## 1. Co se z lekce do prezentace nepřenáší

Z reálného obsahu lekce „Úvod maso":

| V lekci | V prezentaci | Poznámka |
|---|---|---|
| Barevné podbarvení nadpisů karet (v této lekci „Důležité" = oranžové, „Příklad" = zelené, „Tip" = fialové, vlastní béžová `#f2f0eb`, `#fdf4e8`) | Snímek dostane **jednu** barvu — z celé karty, nebo z jejího prvního dítěte | Karta s více různě podbarvenými nadpisy zploští na jednu barvu |
| Úrovně nadpisů (v lekci h1, h2, h3, h4) | Nadpis snímku vždy jedna úroveň, generátor si vynucuje úroveň 3 | Hierarchie „hlavní téma / podtéma" se ztrácí |
| Velikost písma nastavená u bloku | Generátor ji vůbec nečte | Platí i pro barvu textu, font, zarovnání, animaci |
| Callout (rámeček s tipem/varováním) | Převede se na obyčejný odstavec textu | Zůstane text, zmizí rámeček i odlišení |
| Dvousloupcový blok | Sloučí se do jednoho odstavce | Rozdělení do sloupců se ztratí |
| Text s tučným/barevným formátováním uvnitř odstavce | Odstraní se na čistý text | Týká se textového těla snímku |
| Obrázek + text (obrázek vlevo/vpravo), galerie | Zůstane jen jeden obrázek, pozice se ignoruje | U galerie jen první obrázek |
| Karty v mřížce (barvy, ikony jednotlivých karet) | Jen titulek + text karty | |
| Tabulky | Přenášejí se korektně | Funguje |
| Volně umístěné prvky v kartě, počet sloupců karty, barva pozadí karty | Přenášejí se | Funguje |

Upřímně k mezím: **1:1 shoda možná nebude a ani nemá být.** Lekce je dlouhá scrollovatelná stránka s malým písmem, snímek je pevný obdélník 16:9 čtený ze 6 metrů. Dlouhou kartu proto vždy budeme dělit na víc snímků a písmo nastavovat na čitelnou velikost, ne na velikost z lekce. Věrně přenést jde: barvy pozadí (i více barev na snímek), rámečky callout, hierarchii nadpisů, dvousloupcový a obrázek+text layout, celou galerii, barvy karet. Nepřenosné zůstane: přesná délka obsahu na jeden snímek a absolutní velikost písma z lekce.

## 2. Proč se velikost písma u některých snímků neuloží

Dvě různé příčiny:

1. **Velikost písma nastavená u jednotlivého bloku na snímku se při každém otevření zahodí.** Prezentace se před otevřením editoru i před spuštěním vždy tiše přegeneruje z lekce a při spojení uložené a nové verze se obsahové bloky snímku **vždy berou z nové verze** — uložené bloky (a s nimi vaše velikost písma, barva, formátování) se přepíšou. Zachová se jen posuvník „velikost písma celého snímku", nadpis, poznámky, motiv a pozadí.
2. **U snímků, které se po úpravě lekce „nespárují", se zahodí i posuvník velikosti písma.** Snímky se párují podle id zdrojového bloku, jinak podle textu nadpisu. Když se nadpis v lekci přepíše, nebo se blok rozdělí/spojí jinak než dřív (id pak dostává přípony jako `#2`, `#part1`), pár se nenajde a snímek se nahradí čistě novým — bez nadpisu, poznámek, motivu i velikosti písma.

Proto to vypadá „u některých snímků funguje, u jiných ne": u snímků z krátkých textů a se stabilním nadpisem to drží, u snímků z dlouhých spojených karet ne.

## 3. Navrhované řešení

### A. Oprava ukládání (menší, rychlá část)

1. Při spojování uložené a nové verze **nepřepisovat bloky, které učitel ručně upravil.** Zavést u snímku příznak ručních úprav (dotčené bloky si nesou `editedByTeacher`); pro ně se drží uložená verze, ostatní se aktualizují z lekce.
2. **Stabilní párování snímků.** Základem klíče bude id zdrojového bloku bez přípon (přípony z dělení řešit jako druhotný klíč `blok + pořadí části`), takže přejmenování nadpisu ani jiné rozdělení dlouhé karty pár nerozbije. Když se snímek nespáruje vůbec, ruční úpravy se nezahodí — snímek zůstane v prezentaci jako vlastní (jako dnes ručně přidané snímky).
3. **Zámek snímku.** Tlačítko „Neaktualizovat z lekce" u snímku — pro případ, že si učitel snímek přestavěl úplně po svém.

### B. Věrnější přenos vizuálu (hlavní část)

4. **Více barev na snímku:** místo jedné barvy pozadí snímku si každý přenesený blok ponese svoje podbarvení (`backgroundStyle` / vlastní barva) a snímek dostane pozadí jen tam, kde má barvu celá karta. Čitelnost textu se dopočítá zvlášť pro každý barevný blok (dnes se dopočítává jednou pro celý snímek).
5. **Zachovat úroveň nadpisů** — h1/h2 jako titulek snímku, h3/h4 jako mezititulek v těle, s odpovídající velikostí.
6. **Zachovat typ bloku, ne jen text:** callout zůstane callout, dvousloupcový blok dvousloupcový, obrázek+text si udrží stranu obrázku, galerie všechny obrázky, karty svoje barvy a ikony. Tj. místo převodu na plain text předávat blok snímku tak, jak ho už dnes umí vykreslit spojené karty.
7. **Velikost písma:** převzít poměr z lekce (nadpis vs. text), ale vždy dorovnat na čitelné minimum pro projekci; když se obsah nevejde, dělit na další snímek (jak to dělá dnešní logika) místo zmenšování pod čitelnou hranici.
8. **Sjednotit vykreslování** — snímek použije stejný vykreslovač bloků jako lekce s přepsanými barvami podle motivu prezentace, aby se vzhled nerozcházel dvěma nezávislými cestami.

### C. Kontrola

9. Testy na lekci „Úvod maso": počet snímků, počet zachovaných barev, zachování velikosti písma po přegenerování, callout/dvousloupec/galerie.
10. Vizuální kontrola v prohlížeči: lekce vedle vygenerované prezentace.

## Technická poznámka

Dotčené soubory: `src/lib/blocks-to-slides.ts` (mapování, `blockToBodyText`, `slide_group`), `src/hooks/usePresentationLauncher.ts` (`slideKey`, `mergeSlide`, `buildSlidesForLesson`), `src/components/admin/SlideCanvas.tsx` (vykreslení, `flowScale`, kontrast per blok), `src/lib/slide-contrast.ts`, `src/lib/slide-typography.ts`, `src/components/admin/PresentationEditorDialog.tsx` (zámek snímku, příznak ručních úprav). Datový model snímku se rozšíří o `lockedFromLesson` a `editedByTeacher` na úrovni bloku; migrace DB není potřeba (snímky jsou JSON).

Doporučené rozdělení do dvou kroků: nejdřív **A (ukládání)**, protože to je reálná ztráta práce, pak **B (vizuál)**.
