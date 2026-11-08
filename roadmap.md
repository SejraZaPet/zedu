# Roadmap: Nový žákovský prostor (fáze 1)

## Učitelské dlaždice — schválená úprava 8. 11.
- [x] Čtvercové odkazy, 15 rozdílných požadovaných ikon, skryté popisy, široký profil dole; pořadí/cíle a oprávnění zachovány
- [x] Lehké čtecí počty aktivních úkolů, osobních todos a nepřečtených upozornění; nula/chyba skryta; 3 skutečné HEAD dotazy 200, číslice vykreslena
- [x] 56 cílených testů (nepovinný canvas v prostředí dočasně vynechán), automatická kontrola OK; vlastní přihlášená relace 390/640/1024/1440 px bez přetékání, čtverce/ikony/profil a Enter/Space ověřeny; žádné DB změny, e-maily či nasazení
- [ ] Fyzický telefon uživatelky a samostatné role/demo páry neověřeny; jejich oprávnění a stránky se neměnily

## Pracovní list v sešitu — schválená úzká oprava
- [x] Viditelná chyba a opakování načtení podkladu včetně obnovy podepsaného odkazu
- [x] Čekat na dokončené vykreslení; doplnit jen chybějící stránky při opakovaném vložení
- [x] Zastavit export/odevzdání při chybějícím podkladu; miniatury a odpovědi beze změny
- [x] 44 cílených testů; skutečný převod dvou stran a lokální zkouška chyby/opakování na počítači a mobilu
- [x] Tabulka odložena: vyžaduje samostatné schválení změny modelu odpovědí, nikoli jen opravu obrázku
- [ ] Skutečné vložení a odevzdání žákem neověřeno; bez volby žákovského testovacího účtu nejsou povoleny testovací zápisy

## Živý kvíz — schválená etapa 1
- [x] Dokončena diagnostika živého kvízu a úprav AI návrhu; AI editor není součástí této opravy
- [x] Čerstvé konečné výsledky, obnova hráčů, pokles skóre a shody pořadí bez rozšíření oprávnění
- [x] Přezdívky výchozí v přehledu, samostatná výchozí pseudonymizace exportů; funkce přehledu/exportu čekají na nasazení
- [x] Kontrastní odpočet a telefonní otázky/odpovědi bez zmenšeného snímku
- [x] 600 testů a lokální ověření tří šířek telefonů/tabletu; bez publikování, migrací, změn RLS, časů či bodování
- [ ] Ověření skutečné hry na třech telefonech a tabletu s přihlášenými účastníky; lokální ověření použilo simulované odpovědi služby

## Úzká úprava limitu vstupu do dema
- [x] Allowlist akce: 80/h pro dalkove-ucitele, jinak 20/h, denní 500 beze změny; 7 lokálních testů limitů bez účtů prošlo
- [x] Čtením ověřeno předání akce a rizika 50 souběžných vstupů; kapacita hostované služby neověřena, žádná ostrá zkouška ani další změny

## Kalendář: vlastní záznam a hodina navíc
- [ ] Pouze diagnostika UI/polí, historie a oprávnění bez databázových zápisů; určit příčinu a nejmenší samostatnou opravu, realizace vyžaduje výslovné schválení

## Dočasné změny rozvrhu
- [x] Diagnostika a schválený návrh etap
- [x] Izolované jádro jednorázových výjimek bez zapojení do obrazovek; 17 nových testů, všech 557 testů prošlo; ověřeno i jiné časové pásmo
- [x] Migrace 0064 aplikována; první pokus selhal, opravený opakovaný pokus uspěl (opakování nebylo v souladu s pokynem zastavit po selhání)
- [x] Úzce schválená migrace 0065 oprávnění: anon žádná práva, authenticated CRUD; EXECUTE bez PUBLIC/anon, RLS beze změny
- [ ] Schválené učitelské UI jednorázových výjimek — blokuje 0064: třídní výjimky automaticky zveřejňuje a dovoluje čtení spolu-učitelům; bez nové migrace nelze splnit soukromost, žádné UI není zapojeno
- [ ] Funkční ověření nových databázových zápisů a izolace dvou demo párů — povoleno jen na vlastních nových [TEST] demo účtech; čeká na vyřešení uvedené překážky a zvláštní schválení databázové opravy
- [ ] Dávky — čekají na potvrzený školní kalendář; trvalé změny nejsou součástí první etapy

## Nástroje do hodiny
- [x] Viditelnost v demu: přímý odkaz, nová karta ve starém pořadí; nové/obnovené demo a šest nástrojů ověřeny; 540 testů, předvýběr skutečné třídy, 3 vlastní páry/6 účtů uklizeny
- [x] Nástroje v editoru/náhledu a učitelském časování plánu: sdílený překryv, čas fáze a předvýběr třídy/skupiny bez ukládání
- [x] Ověřit zachování neuloženého plánu, odpočty a návrat (537 testů; přihlášený editor i uložený náhled, telefon/fullscreen); rollback v docs/classroom-plan-tools.md
- [x] Diagnostika navigace, seznamů žáků, projektoru a živé infrastruktury bez změn
- [x] Etapa A: šest lokálních nástrojů, navigace a karta přehledu
- [x] Testy logiky a přihlášená kontrola na telefonu/projektoru (532 testů; šest cest, fullscreen, oprávněná třída a vlastní izolované demo; zkouška uklizena)
- [x] Etapa B: návrh hlasování a moderovaných nápadů
- [ ] Etapa B: implementace a migrace čekají na výslovné schválení plánu

## Banka slov v doplňování
- [x] Banka slov, vracení slov, kliknutí a přetahování včetně dotyku
- [x] Nastavení editoru, výchozí zapnuto, falešná slova
- [x] Testy bodování/answers (453 testů); náhled Poživatin: přetažení, vrácení, dotyk a 5 odpovědí i po obnovení

## Kontrola odpovědí aktivit v lekci
- [x] Přidat nepovinné answers bez změny existujících dat a politik
- [x] Ukládání a přehled odpovědí v lekci i po návratu, staré výsledky beze změny
- [x] Testy a přihlášené ověření (449 testů, build OK; Poživatiny: 8 položek ihned i po obnovení)
- [ ] Doplnit správné odpovědi tří výroků Poživatin — vyžaduje potvrzení autorky, obsah ani skórování nebyly změněny

- [ ] A) Opravy zabezpečení a dat (jen DB)
  - [ ] A1 student_xp: žák nesmí insert/update vlastní řádek; čte jen svůj; žebříček přes bezpečnou funkci/pohled (spolužáci)
  - [ ] A2 učitel čte student_xp + student_badges jen žáků svých tříd/skupin
  - [ ] A3 student_activity_results: čtení pro učitele tříd/skupin žáka; ověřit TeacherResults rozbor
  - [ ] A4 student_practice_sessions + student_lesson_mastery: čtení učitelem i přes subject_group_members
  - [ ] A5 XP za odevzdání úkolu: trigger na assignment_attempts (ne submissions), jednou, bez zdvojení
  - [ ] Vypsat seznam změněných politik a funkcí
- [ ] B) StudentDashboard „Dnes“
  - [ ] Pořadí: pozdrav+avatar+série/XP, TodayWidget, „Co mě čeká“, StudentProgressWidgets, RecognitionWidget, „Další“ + karta „Učím se“ → /student/metody
  - [ ] Karta „Co mě čeká“: testy/zkoušení/písemky 14 dní, tlačítko „Připravit se“
- [ ] C) Studijní lišta u lekce (LessonPage + StudentTextbookDetail)
  - [ ] Kartičky (flashcards/reveal bloky, jinak AI edge fn lesson-study-helper režim cards, max 15, neukládat)
  - [ ] Shrnutí (režim summary, 5 odrážek, tykání)
  - [ ] Kvíz → /student/metody/<metoda>/procviceni?lesson=<id>&min=5
  - [ ] Zeptat se → ask-zedai-tutor s textem lekce (max 6000 znaků), i v StudentTextbookDetail
  - [ ] AI označení + demo kvóty zachovat

## Otevřené z minula
- [ ] Sjednotit délku platnosti zaváděcí ceny na webu (čeká na potvrzení majitelky)
- [ ] Ověřit připínání aktivit v plánu v browseru

## Oprava textu lekce pro procvičování
- [x] Sdílená extrakce vnořených bloků a čistý kontext chatu
- [x] Odmítnutí krátkého textu a srozumitelná hláška v procvičování
- [x] Testy, nasazení funkcí a ověření Poživatin (439 testů; 4 otázky v náhledu)

## Živé hry – sjednocení
- [x] Etapa 1a: převod Pravda/Nepravda, spojování, doplňovačka, seřazení na otázky při spuštění (šablony, knihovna, Rychlá hra, prezentace)
- [x] Etapa 1b: převod i z plánu lekce; staré jednosnímkové hry se rozloží při spuštění
- [x] Etapa 1c: ruční vizuální kontrola projektoru (ukázkový kvíz: jedna otázka, výsledky v %)
- [x] Etapa 2: bodování podle režimu na serveru, obě cesty, krádež + lupič + týmy (nasazeno)
- [x] Klíč aktivity do add_xp (spolu s migrací ligy)
- [x] Etapa 3: jedno jádro pro obě cesty (live-game-core.ts)
- [x] Ostrá zkouška [TEST] her se 3 hráči (40 her, 0 chyb), úklid hotový
## Bezli liga v1
- [x] xp_events, add_xp (strop, opakování, série), skupiny 30, Bronz–Diamant, cron, soutěž tříd, záložka Liga, odznaky
- [x] Ruční kontrola záložky Liga v prohlížeči (vlastní [TEST] škola, opt-out a soukromí)
- [x] Dokončit kontrolu původního class_leaderboard: bezpečný žákovský RPC, top 10 + vlastní pozice, skryté cizí identifikátory; schválená migrace 0061.

## Naplnění dema ukázkami
- [x] Diagnostika učebnic, knihovny her, seed/reset a úklidu
- [x] Aplikace: ukázkové učebnice v Moje učebnice, štítek a otevření lekcí pouze ke čtení
- [x] Ověřit učebnice v náhledu jako demo učitel (dvě knihy, otevření lekce pouze ke čtení)
- [x] Tři ukázkové hry, idempotentní doplnění párů a reset — schválené migrace 0062–0063; pět původních párů má po třech hrách
- [x] Ověřit izolaci dvou párů, kvíz s [TEST] hráčem, projektor a úspěšnost v %, uklidit jen vlastní testovací data (osm vlastních párů a 16 účtů odstraněno; 525 testů prošlo)

## Etapa 1 – nálezy z testu na bezli.cz (16. 10.)
- [x] Telefon: Pravda/Nepravda velká tlačítka s popisky (ověřeno v náhledu)
- [x] Lobby text bezli.cz/live/pripojit + adresy /hra a /live vedou na připojení
- [x] Lišta „Prohlížíš jako“ nezakrývá tlačítka (spodní odsazení)
- [x] Průvodce: počet položek se dodrží (oříznutí výstupu AI)
- [x] Výsledky po ukončení: přehled se načte hned, „Zatím žádné odpovědi“
- [x] Smazána první kopie „Charakteristika…“; druhá (17:00) čeká na potvrzení
- [x] Bezli liga v1
- [x] Dialog AI listu: šířka + volba Nezahrnout (schváleno)
- [x] Klíč odpovědí/učitelská verze na poslední stránce, náhled v liště = export, písmena u MCQ

## Bannery
- [x] Etapa 1: tabulka banners + RLS + trigger limit, get_my_banners(), veřejný bucket s limitem 3 MB
- [x] Etapy 2 a 3: zobrazení na třech dashboardech, správa platformní i školní, demo účty bez formuláře
- [x] Náhled vybraného souboru: blob URL se nepočítá jako cesta v úložišti
- [x] Banner se nikdy neořezává: kontejner max 720 px, poměr 3/1, object-contain i pro video a poster; 658 testů, měření v prohlížeči (desktop 720×240, telefon 358×119, náhled formuláře 622×208)
- [ ] Bannery pro vedení: zástupci vedení zatím vidí jen učitelské — čeká na schválenou úpravu databáze


## Sešit na tabletu (Část F)
- [x] Měření PŘED, rozložení pod xl, miniatury s obrázkem, testy, měření PO

## Spojování v editoru pracovního listu — bílá stránka
- [x] Oprava náhledu, přehrávače, tisku, klíče a ochrana náhledu; 5 regresních testů
- [ ] Nasazení až po pokynu „nasadit“; kliknutí v běžící aplikaci neověřeno

## Žákovské prostředí na telefonu — schválená fáze 1 (bez DB)
- [x] Stavy úkolů, Materiál/Oznámení a pozdní odevzdání jsou v kódu všech 5 stránek (ověřeno čtením)
- [x] Rozvrh na telefonu: přepínač dne a seznam; lichý/sudý ve vlastním řádku, v mřížce zkratky
- [x] Kompaktní pilulka testovacího žáka vpravo dole
- [x] Předmět: karty/tlačítka se zalamují, záložky ve 2 řádcích, 44 px, „Otevřít“
- [x] Přehled: Dnes nahoře na mobilu; „Moje úkoly“ v menu
- [ ] Kontrola na 390 px v prohlížeči — čeká na přihlášení testovacím žákem (vyžaduje souhlas)
- [ ] Nasazení — čeká na „nasadit“
- [ ] Spodní navigační lišta — až po prověření screenshotů učitelkou

## Přepínání rolí a druhy úkolů (schváleno 5. 11. 2026)
- [x] Menu „Přepnout roli“ podle stávajících oprávnění, návrat z testovacího žáka, pilulka nad lištou Safari, Administrace v patičce jen pro admina
- [x] Žák: souhrn Úkoly/Materiály/Oznámení; učitel: „Přidat“ s volbou druhu a předvyplnění ?kind=
- [ ] Ověření na iPhonu v přihlášené relaci (bez souhlasu nepřihlašovat za žáky); nenasazeno

## Lišta „Prohlížíš jako“ a čitelná projekce (schváleno 6. 11.)
- [x] Kompaktní lišta v rohu, na promítání jen ikona; návrat na admina zachován
- [x] Projektor: jedno škálování, překryvné ovládání, A−/A+, celá obrazovka, čistá projekce, „Kód vždy viditelný“
- [ ] Ověření v prohlížeči na skutečné projekci (1920×1080, 1440×900, 390×844) – chybí vlastní ukázková relace bez zápisu do databáze

## Plán u přiřazené hodiny a tisk AI metody (6. 11.)
- [x] „Změnit“ na kartě hodiny: jiný plán / nový / odebrat s potvrzením; odpojení z ostatních plánů
- [x] Diagnostika tisku AI metody – zapsána v plánu, čeká na schválení

## Lišta „Prohlížíš jako“ na mobilu
- [x] Dole uprostřed, rezerva pod obsahem, desktop beze změny

## Vyhledávání ve výběrech
- [x] A: Schválené etapy 1–2, společné hledání a výběry; etapy 3–5 se neprovádějí
- [x] A: 21 testů, build OK; společný výběr 390/1440 px a klávesnice ověřeny bez účtů; celé přihlášené stránky a samostatná kontrola typů neověřeny

## Záložka „Práce“
- [x] Přejmenování hlavní záložky Úkoly → Práce

## Zeď jako stream
- [x] B: Pouze učitelský příspěvek jako oznámení, výchozí bez e-mailu; kontextové Přidat a návrat
- [x] B: 61 cílených testů obou částí; build OK, místní editor 390/1440 px, text/odkaz/zveřejnění/nabídka Přidat ověřeny bez skutečných zápisů
- [ ] Přihlášené načtení nového příspěvku ze skutečné třídy, upload souboru a celostránkové výběry neověřeny: testovací zápisy zakázané; samostatná kontrola typů neprovedena (kontroly spravuje prostředí)
- [ ] Samostatné commity A/B a nasazení: git i publikování spravuje prostředí, agent gitové commity nespouští; nasazení provede Claude

## Myšlenkové mapy — schválená etapa 1
- [x] Sdílená mapa (strom, 60 uzlů, hloubka 4), blok učebnice, „Doplň mapu“ v pracovním listu, hodnocení, tisk, testy
- [ ] Ověření v prohlížeči a na 390 px
- [ ] Etapy 2–5 (vlastní mapa žáka, AI, aktivita, společná mapa) čekají na schválení

## Tahák — schválená etapa 1
- [x] Čtením DB ověřeno owner-only ukládání notebook_pages.content přes owns_notebook; samostatné označené kontejnery v notebooks jsou vyloučené ze sešitů i výběrů procvičování, žádná změna schématu/oprávnění
- [x] Ruční tvorba, přístupný text lekcí, vlastní seznam, líc/rub, limity, symboly, mobil, tisk/PDF; žádné AI
- [x] Informativní nastavení „Tahák povolen“, výchozí ne; u testů žádné nové tlačítko ani otevření sešitu
- [x] 48 cílených testů, automatické typy/build OK; izolovaný editor na 390/1280 px, počítadla, lokální save callback, 2stránkové PDF a 10 karet na A4 ověřeny bez hostovaných zápisů
- [ ] Přihlášený žák: skutečné uložení a opětovné načtení, výběr textu z oprávněné lekce, izolace druhého účtu/demo a uložený učitelský štítek — vlastní relace je admin, přepnutí/testovací zápisy bez dalšího souhlasu neprováděny
- [ ] Fyzický oboustranný tisk a telefon uživatelky neověřeny; nasazení provede Claude, žádné DB změny ani e-maily

## Formulář podle druhu (úkol / materiál / oznámení) — schválené etapy 1–2
- [x] KIND_FIELDS, kindHas, neutralizeForKind, texty podle druhu, zámek změny druhu při pokusech
- [x] Skryté úkolové sekce u materiálu/oznámení, neutrální uložení, karty bez termínu/pokusů/zámku/typu
- [x] Výsledky a detail třídy bez materiálů/oznámení; rodičovský přehled ukazuje jen pokusy (bez chyby)
- [ ] Nadpis „Materiály k úkolu“ v editoru příloh zatím obecný; edge funkce (notify-parent, připomínky) nezměněny dle pokynu

## Materiál: více lekcí a listů
- [x] Etapa 1: více lekcí u materiálu (settings.lessons), řazení/odebrání, počet na kartách, úkol beze změny, testy
- [ ] Ověření v prohlížeči jako učitel/žák a 390 px
- [ ] Nabídka listů lekce po přidání lekce (vazba worksheets.source_lesson_id) – čeká na schválení
- [ ] Etapa 2: více listů u materiálu + oprava politiky čtení listů – SQL v plánu, čeká na „schvaluji“
