# Roadmap: Nový žákovský prostor (fáze 1)

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
