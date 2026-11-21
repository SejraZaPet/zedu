# Editor prezentací ve stylu Canvy – analýza a plán (prezentace-editor-canva-2026-11-21)

Jen analýza a návrh. Nic se nemění v kódu ani databázi a nic se nenasazuje. Pozor: schválení tohoto plánu v okně neznamená pokyn k realizaci. Každou etapu je třeba výslovně zadat.

## 0. Proč vkládání a vytváření aktivit „nefunguje“ (zjištěno v kódu, bez ručního ověření)
1. **„Přidat snímek → Vložit z knihovny her“ je v editoru prezentací skryté.** Editor otevírá nabídku jen s rozvrženími (`layoutsOnly`), takže sekce aktivit a knihovny se vůbec nezobrazí. Kód pro vložení existuje, ale tato cesta je mrtvá.
2. **Aktivita má dvě nezávislé kopie.** Vložení z lekce uloží aktivitu jako blok na slidu i jako `activitySpec`. Formulář aktivity upravuje `activitySpec`, plátno vykresluje blok a živá hra čte `activitySpec`. Úprava v editoru se tak nemusí projevit ve hře, nebo naopak.
3. **„AI aktivita“ ukládá špatný tvar dat.** Vždy vytvoří kvízovou otázku (otázka, možnosti, správný index), ale označí ji typem podle plánu: pravda/nepravda, dvojice, zeď, anketa nebo otevřená. Tyto typy čekají jiná data, takže v promítání a na telefonu jsou prázdné nebo rozbité.
4. **„Aktivity → Přidat aktivitu“ (např. Kvíz)** vždy vytvoří nový slide za aktuálním, nikdy prvek ve slidu. Šablona má jen `activitySpec` bez bloku, takže editor na plátně ukáže prázdný slide. Celou aktivitu vidí až projektor nebo žák.
5. **„Z mých lekcí“** bere jen aktivity nejvyšší úrovně z 60 posledních vlastních lekcí a nejvýš 20 kusů. Aktivity vnořené do sloupců nebo skupin a aktivity ze Studia se nenabídnou.
6. **Spuštění živé hry z prezentace** jde jinou cestou než spuštění ze Studia:
   - kvíz s více otázkami se nerozloží na jednotlivé otázky;
   - kroky ze Studia se nepřipraví stejně (body, týmy, přeskočení nepodporovaných);
   - převodník do otázek zná jen kvíz, pravdu/nepravdu, dvojice, doplňování a seřazení, a typ `mcq` nezná;
   - ostatní typy (slovní mrak, anketa, zeď, exit ticket, pexeso, křížovka…) běží jen jako „žáci plní aktivitu“ bez bodování.
7. **Ve slidu chybí tlačítko „aktivita jako prvek“.** Jde vkládat jen text a média.
8. Uloží se jen po kliknutí na „Uložit“. Vložení samo nic neukládá, takže zavření bez uložení aktivitu ztratí, a to bez varování (ověřit).

## 1. Inventář funkcí (spolehlivé / problém)
**Funguje (podle kódu):**
- generování z lekce včetně uložených úprav učitele;
- přímá manipulace na plátně (přetažení, 8 úchytů, otáčení, přichytávání a mřížka, výběr více prvků i tažením myší, kopírovat a vložit);
- zpět/znovu, miniatury s přetažením pořadí;
- pozadí slidu (barva, přechod, obrázek), motivy (6), styl textu v bloku;
- export do PDF, import PPTX (jen text);
- živá hra: PIN, projektor, učitelská obrazovka, telefon žáka;
- týmové, diferencované a únikové aktivity na telefonu;
- nastavení hry na slidu, výběr pozadí v živé hře, swipe v promítání.

**Problém nebo neúplné:**
- body 0.1–0.8 výše;
- spuštění ze seznamu prezentací chybí (jde jen z editoru);
- propojená prezentace: propojení vlastní prezentace s lekcí zapíše `lesson_id`, a editor ji pak odmítne otevřít;
- tlačítka předchozí/další jsou dole, ne nahoře;
- klávesy neověřeny;
- nástroje do hodiny jsou plné jen v tempu plánu hodiny, v promítání prezentace je jen menší nabídka „Nástroje“;
- export do PPTX z editoru prezentací chybí (exportní modul nezná bloky, pozice ani pozadí);
- sdílení prezentace a samostatný tisk v editoru nenalezeny; „účel“ existuje jen u šablon her;
- velikost: editor má 2 160 řádků, plátno 2 619 řádků, což zvyšuje riziko regresí.

## 2. Datový model
**Dnes:**
- slide je volné JSON v `teacher_presentations.slides` (a `lesson_plans.slides`): `type`, `projector`, `device.instructions`, `teacherNotes`, `blocks[]`, `layout`, `backgroundOverride`, `themeId`, `gameSettings` a u aktivit `activityType` + `activitySpec`;
- bloky mají volitelný `frame {x, y, w, h}` v % plátna 1600×900 a `zIndex`;
- **volné plátno už model unese, nový model není nutný.**

**Návrh jednotného slidu (verze 2, zpětně kompatibilní, bez změny databáze):**
- Slide = pozadí, motiv, poznámky učitele, seznam prvků. Každý prvek má `frame`, `zIndex`, `locked` a `hidden`.
- Typy prvků: text, nadpis, odrážky, obrázek, tvar (včetně zaoblení), ikona, tabulka, graf, video, vložený obsah, skupina a nově **aktivita**.
- **Prvek aktivita** = přesně jeden `ActivityStep` ze Studia (sdílený tvar a adaptéry z `studio-step.ts`), jediný zdroj pravdy. `activitySpec` se už samostatně neukládá, ale při čtení se odvodí z prvku. Nejvýš jedna aktivita, která se hraje, na slide; ostatní prvky slidu jsou jen podklad.
- **Migrace při otevření (líná, bez ztráty):**
  - staré slidy bez rámu zůstanou v toku;
  - kde je `activitySpec` i blok aktivity, vezme se novější z nich podle posledního zápisu z formuláře;
  - pokud nelze rozhodnout, zachová se `activitySpec` a blok se z něj znovu vytvoří, obě původní verze zůstanou v historii zpět/znovu;
  - kvízová data označená jiným typem (AI chyba) se opraví zpět na kvíz;
  - zapisuje se až při uložení učitelem a stará pole se ponechají pro zpětnou kompatibilitu.
- **Databáze:** pro etapy 0–3 není změna nutná. Volitelně později: verze schématu ve sloupci, sdílení prezentací (nová tabulka nebo politika), knihovna sdílených aktivit. Jen popis, ke schválení.

## 3. Etapy (od nejmenšího rizika)
**Etapa 0 – oprava aktivit (bez databáze, asi 2–3 dny)**
- zpřístupnit „Vložit z knihovny her“ v editoru;
- jeden zdroj pravdy pro aktivitu (synchronizace bloku a `activitySpec`);
- opravit typ u AI aktivity;
- šablony aktivit vykreslit i na plátně editoru;
- „Z mých lekcí“ i s vnořenými aktivitami a stránkováním;
- spuštění prezentace stejnou přípravou jako Studio (rozložení kvízu, body, týmy, hlášení přeskočených typů);
- varování při zavření s neuloženými změnami;
- integrační test vložit → upravit → uložit → znovu otevřít → spustit pro každý typ.

*Po etapě:* aktivity jdou spolehlivě vložit a zahrát. *Ověřit:* 5 typů v živé hře na projektoru a telefonu.

**Etapa 1 – rychlé opravy z backlogu (asi 2 dny)**
- spustit ze seznamu prezentací;
- tlačítka předchozí/další nahoře (swipe a klávesy zůstanou);
- stejné nástroje do hodiny v každém promítání (sdílený `ClassroomToolsOverlay`);
- propojení lekce s upravenou nebo vlastní prezentací: místo odmítnutí editor nabídne „Upravit kopii propojenou s lekcí“, nebo bude propojení jen odkazem. Bez databáze, přes stávající `teacher_presentations` pro učitele.

**Etapa 2 – rozvržení jako v Canvě (asi 5–7 dní)**
- levý panel prvků (nadpis, text, odrážky, obrázek, tvar, ikona, tabulka, video, graf, **aktivita**);
- pravý panel vlastností podle vybraného prvku;
- dolní nebo levý pás miniatur;
- vrstvy (dopředu/dozadu), zamknutí, zarovnání a rozmístění více prvků;
- ovládání na tabletu (větší úchyty, dlouhé podržení = nabídka, dvěma prsty přiblížení plátna).

Editor se přitom rozdělí na menší části: stav, panely, plátno. Funkce zůstanou.

**Etapa 3 – aktivity přímo v editoru (asi 4–5 dní)**
- vytvořit libovolný typ ze Studia přímo ve slidu (sdílené editory kroků, čas, body, obrázky, vysvětlení);
- vložit z lekce, ze Studia nebo knihovny, i jeden nebo více slidů z jiné lekce nebo prezentace;
- sdílené aktivity jiných učitelů jen tam, kam dnes učitel smí. Rozšíření sdílení by vyžadovalo změnu databáze (jen popis).

**Etapa 4 – věrný import PPTX a PDF, export PPTX (asi 6–8 dní)**
- podle schváleného plánu importu PowerPointu;
- PDF: každá stránka jako obrázek pozadí a volitelně rozpoznaný text jako upravitelné textové prvky;
- export PPTX z editoru s pozadím, pozicemi, tvary, obrázky a poznámkami (pptxgenjs už v projektu je).

**Etapa 5 – šablony a motivy (asi 3 dny)**
- galerie šablon slidů a celých prezentací, rozšíření motivů.

**Stejný vzhled všude:** editor, promítání, telefon i PDF dál používají jedno vykreslování (`SlideCanvas`/`SlideBody`). Každá etapa přidá test, který porovná vykreslení editoru a projektoru stejného slidu.

## 4. Import PPTX a PDF
- **PPTX:** viz schválený plán importu PowerPointu. Přenese se:
  - pozadí (barva, přechod, obrázek ze slidu nebo předlohy);
  - barvy, velikosti, tučnost a velká písmena;
  - pozice prvků;
  - obdélníky, zaoblené karty a pilulky;
  - obrázky;
  - poznámky do poznámek učitele, nikdy k žákovi.

  Rizika:
  - skupiny tvarů se rozloží na jednotlivé prvky;
  - ze SmartArtu se přenese jen text;
  - animace se nepřenesou;
  - chybějící písma nahradí podobná;
  - přechod se 3 a více barvami se zjednoduší;
  - deky 4:3 budou mít okraje.
- **PDF:** spolehlivě jako obrázek stránky (věrné, ale neupravitelné). Volitelně textová vrstva, kterou PDF obsahuje, jako průhledné upravitelné texty. Skenované PDF jen jako obrázky.
- **Obrázky:** ukládají se do `lesson-images/presentations/<učitel>/…`, stejně jako dnešní pozadí. Platí:
  - nejvýš 10 MB na soubor a celkový limit na import (např. 60 MB);
  - zmenšení na nejvýš 2560 px;
  - jen PNG, JPG, GIF a WebP, ověřené podle obsahu;
  - SVG, EMF a WMF se přeskočí s upozorněním;
  - stejný obrázek se nahraje jen jednou.
- Na konci se zobrazí souhrn, co se nepřeneslo.

## 5. Výkon, tablet a mobil
- miniatury se vykreslují zjednodušeně a až při zobrazení, s virtualizací pásu při více než 30 slidech;
- velké JSON: obrázky jen jako adresy, nikdy vložená data; ukládání po kouscích je možné později;
- přetahování bez překreslení celého editoru (stav prvku po dobu tažení odděleně);
- na tabletu dotykové cíle aspoň 44 px, výběr klepnutím, posun dvěma prsty, vlastnosti ve spodním panelu;
- na telefonu 390 px editor jen pro drobné úpravy, plnohodnotný od tabletu.

## 6. Testovací scénáře
1. **20slidová přednáška (PPTX):**
   - gradientní pozadí je jako obrázek bez okrajů;
   - titulka s obrázkem přes celý slide;
   - bílé nadpisy velkými písmeny;
   - krémové zaoblené karty, tyrkysové pilulky;
   - poznámky jsou jen u učitele;
   - editor, projektor a PDF vypadají stejně.
2. Do slidu se vloží aktivita z lekce, upraví se otázka, uloží, znovu otevře a změna je i v živé hře.
3. Živá hra z prezentace s kvízem (3 otázky), pravdou/nepravdou, dvojicemi, seřazením a slovním mrakem: PIN, 3 žáci na telefonech, body, pořadí a výsledky.
4. Týmová aktivita v prezentaci, s rozdělením do týmů a body týmů.
5. Vložení aktivity ze Studia a knihovny her, a 3 slidů z jiné prezentace.
6. AI aktivita typu pravda/nepravda má správná data a jde zahrát.
7. Promítání na projektoru: tlačítka nahoře, šipky na klávesnici, swipe na tabletu, nástroje do hodiny (časovač, losování).
8. Spuštění ze seznamu prezentací, vygenerované i vlastní.
9. Propojení vlastní upravené prezentace s lekcí, která pak jde dál upravovat.
10. Demo účet: vše funguje v limitech dema, nic sdíleného se nepřepíše.
11. Tablet: přetažení, změna velikosti a vrstvy prstem, zpět/znovu.

## 7. Odhad a nejistoty
- Celkem zhruba 22–30 dní práce. Etapa 0 dává největší užitek hned.
- **Nejistoty:**
  - jak slučovat staré dvojí kopie aktivit;
  - typy bez bodování (slovní mrak, zeď…);
  - shoda vykreslení v PDF a exportu do PPTX;
  - velký editor (riziko regresí, proto rozdělit);
  - věrnost importu (předlohy, písma).
- **Knihovna pro plátno:**

| Varianta | Licence | Velikost | Hodnocení |
|---|---|---|---|
| **Vlastní řešení (dnešní `SlideCanvas`)** | vlastní | 0 navíc | **Doporučeno.** Přetahování, úchyty, přichytávání i výběr více prvků už existují. Plátno je normální HTML, takže zůstane přístupné, text jde upravovat, a projektor, telefon i PDF vypadají stejně. |
| Konva (react-konva) | MIT | asi 150 kB | Kreslí na canvas: text a přístupnost se musí řešit znovu a projektor/PDF by potřebovaly druhé vykreslování. |
| Fabric.js | MIT | asi 300 kB | Stejný problém jako Konva, navíc těžší integrace s Reactem. |
| tldraw | vlastní licence (komerční použití vyžaduje licenci nebo vodoznak) | velká | **Nedoporučuji.** Licence, velikost a jiný model dat. |

  Doporučení: zůstat u vlastního HTML plátna a jen rozšířit dnes použitou knihovnu dnd-kit (pás miniatur, panely). Nedělat sami věrný PPTX export animací a SmartArtu, ani OCR celých PDF ve vlastní režii.

## Databáze (jen popis, ke schválení)
- Etapy 0–5 bez změny.
- Volitelně: sloupec verze schématu slidu, sdílení prezentací mezi učiteli (tabulka a RLS), sdílená knihovna aktivit.
