# Roadmap

## Demo – uložení práce a připomínky (schváleno etapy 1–2, termín 25. 11.)
- [x] (1) migrace a RPC – finální SQL ukázat před spuštěním
- [x] (2) demo-save-contact + dialog + odpočet + export
- [x] (3) demo-expiry-reminders + demo-unsubscribe + plán úlohy
- [x] (4) testy, dokumentace, celá sada
- Etapy 3 a 4 jen návrh. Čeká na nasazení: funkce + vytvoření plánované úlohy (pokyn Tyny).

## Poptávky licencí – jen plán (bez změn)
- [x] Plán `.lovable/plan/poptavky-licence-ulozeni-admin-2026-11-19.md`

## Datumové řazení úloh a materiálů
- [x] Projití učitelských i žákovských seznamů; strukturální pořadí, kalendář, termíny a žebříčky zůstaly beze změny.
- [x] Listy v lekci a fronta „Ke kontrole“ nyní od nejnovějšího; ostatní datumové seznamy zachovávají směr a shodná data řadí podle ID. Bez DB/RLS a nasazení.
- [x] 40 cílených testů prošlo; celá sada 1113/1120, sedm starších nesouvisejících chyb. Typy a build OK.
- Neověřeno vizuálně v učitelském účtu: administrátorský náhled se přesměroval na úvod. Explicitní ruční volba „od nejstaršího“ v katalogu učebnic zůstala zachována.

## Učím se – více fotografií
- [x] Galerie do šesti fotek, samostatný foťák, sekvenční přepis, pořadí/odebrání/opakování a úklid náhledů bez DB či nasazení.
- [x] Mock testy dávek a potvrzení, regrese procvičování; typy a build OK. Přihlášená stránka při 390 px: dvě fotky, mock OCR, pořadí/odebrání/potvrzení bez posunu a bez zápisů ověřeny.
- Neověřeno: živé AI, nativní galerie iOS/Android a HEIC; nic nenasazeno.


## Více fotografií – diagnostika a oprava
- [x] Rozšířená kontrola: Z materiálu, herní pozadí, knihovna a přetažení/schránka lekce; opraveny nalezené ztráty a chyby. 247 testů / 49 souborů, typy a build OK; dvě fotky Z materiálu při 390 px bez AI a bez posunu ověřeny.
- [x] Prověřit portfolio, galerie/prezentace, úkoly, avatary, listy a sešit; opravit dávkové zpracování.
- [x] 246 testů / 47 souborů, typy a build OK; portfolio při 390 px i skutečné uložení/načtení dvou fotek ověřeno, vlastní test uklizen. Bez DB/RLS a nasazení.
- Neověřeno: nativní galerie iOS/Android a skutečné uložení dávky mimo portfolio. Samostatný obrázkový blok a obrázek položky listu zůstávají jednosouborové; více obrázků patří do galerie.

## Učím se – fotografie jako zdroj (schválené kroky 0–3)
- [x] Krok 0: izolace posledních výsledků žáka v `ai-practice-rag` a test obtížnosti.
- [x] Krok 1: lokální příprava fotografie, mobilní výběr, soukromí a náhled bez AI.
- [x] Krok 2: specializovaný AI přepis a povinná kontrola textu žákem; bez nasazení.
- [x] Krok 3: potvrzený text jako `photo` ve stávajícím procvičování a regrese.
- Čeká na samostatný pokyn: nasazení `extract-practice-photo-text` a živý test s fotkou; model `google/gemini-2.5-flash` je dostupný, ale zastaralý, uživatelka byla dotázána na případnou změnu.

## Demo – únik obsahu skutečných učitelů (schváleno, etapy 1–3)
- [x] Etapa 1: demo_iso_strict na worksheets (0083)
- [x] Etapa 2: demo_iso_strict na teacher_presentations a teacher_textbooks (0084)
- [x] Etapa 3: demo_guard_update/delete na lessons (0085)
- Neověřeno: skutečné přihlášení demo účtem (ověřeno jen přepočtem pravidla nad daty)

## Časovač a „Spustit“ u živých aktivit – čeká na schválení plánu
- [ ] Plán připraven, neimplementovat bez „schvaluji“

## Přiložení pracovních listů – dvě schválené opravy
- [x] Štítky a potvrzené zveřejnění nezveřejněných listů ve formuláři
- [x] Přidání do existující úlohy a varování před duplicitním novým zadáním
- [x] Čtecí diagnostika, cílené testy a kontrola 390 px; bez DB/RLS, edge funkcí, deploye a mazání
- Neověřeno: původní stav před zveřejněním a skutečný zápis/čtení žákem; ověřování zápisů pouze místní simulací, data učitelky nedotčena.

## Aktivity z vlastních lekcí – schválené etapy 1+2
- [x] Sdílené okno: vlastní lekce → část → typ/počet → upravit návrh → vložit koncept
- [x] Rychlá hra, Moje aktivity a editor pracovního listu; zdroj v existujícím JSON
- [x] Testy vlastnictví, textových limitů, metadat, chyb a konceptů; kontrola 390 px s místním testovacím návrhem
- Neověřeno: skutečné AI a uložení/žákovské čtení (účet nemá vlastní lekce; žádná testovací data v DB nevytvářena).
- Bez DB/RLS, edge funkcí a nasazení; obtížnost, otevřené otázky a upozornění na změnu lekce nyní nedělat

## Hodnocení úkolů – etapy 1+2 (schváleno) – HOTOVO
- [x] Etapa 1: stránka „Ke kontrole“ (/ucitel/ke-kontrole) – seznam, filtry, hledání žáka, Další/Předchozí + klávesy J/K, bodování stávajícím mechanismem
- [x] Etapa 2: hromadné akce (zkontrolováno, společný komentář, šablony), potvrzení, „Upozornit žáky“ výchozí vypnuté, „Vrátit zpět“ (undo); score/status se nemění
- [x] Odkaz z dashboardu (dlaždice „Ke kontrole“) a z nabídky v záhlaví
- [x] Testy (13 nových, 24 cílených), typy, build, mobil 390 px bez posunu

## Pracovní list: Postup podle metody + Příklady z praxe (etapy 1–3 schváleny) – HOTOVO
- [x] Etapa 1: nový typ `method_steps` (fáze max 8, výchozí 0 b., bodovaná fáze = ruční hodnocení jako open_answer), editor, přehrávač, tisk/PDF, offline export
- [x] Etapa 2: dialog „Přidat část → Postup podle metody“ – katalog metod (steps_json) + jedním klikem z posledního Návrhu podle metody
- [x] Etapa 3: nový typ `practice_examples` (ruční; nadpis, situace, volitelná otázka, volitelné body); AI tlačítko NEZOBRAZOVAT
- [x] Testy (14 nových, 34 cílených), typy, build; dialog ověřen v prohlížeči; vložený blok v prohlížeči neověřen (vyžadovalo by zápis do cizího listu)
- Etapa 4 (AI návrhy příkladů, edge funkce) NESCHVÁLENA – nedělat

## Generovaná prezentace – schválené kroky 1+2
- [x] Krok 1: čitelnost generovaných snímků a A+/A− na učitelské i projektorové obrazovce; testy a samostatný commit.
- [x] Krok 2: kopie „Uložit jako moji prezentaci“, automatické `lockedFromLesson`, obnovení snímku z učebnice; testy a samostatný commit.
- [x] Závěrečná kontrola obou commitů; bez migrací, kroku 3 a nasazení. V prohlížeči ověřena samostatná kopie i obousměrná synchronizace písma; samostatná vizuální kontrola obnovy snímku se nepodařila.

## Pracovní list – přímá úprava textu (schválené kroky 2+3)
- [x] Krok 2: možnosti ABCD, tvrzení pravda/nepravda přes prompt, callout, image_text a flow_steps; samostatný commit.
- [x] Krok 3: pevné buňky tabulky přes sdílenou logiku, žákovská vyplnění beze změny; samostatný commit.
- Bez DB, migrací, formátování textu a nasazení; regrese celé sady pracovních listů.

## Bezpečnostní sken – avatar_profiles a subjects (schváleno)
- [x] Před migrací ověřit všechna zobrazení cizích avatarů, vazby her/zpráv/tříd/skupin a zástupnou ikonu.
- [x] Ověřit čtení předmětů přes cizí a sdílený obsah; zdokumentovat dopad na budoucí školní předměty.
- [x] Aplikovat pouze schválená SELECT pravidla a pomocnou funkci `can_see_avatar`; bez simulace rolí a bez nasazení.
- [x] Spustit bezpečnostní sken, ověřit zbývající nálezy a typy; dva kritické nálezy odstraněny.
- [ ] Uživatelka: vlastní simulace rolí v transakci; agent ji podle pokynu neprováděl.

## Pozdější etapy (NESCHVÁLENO – nedělat)
- Etapa 3: stupnice/známky, převodní tabulka, zobrazení žákovi po „zkontrolováno“
- Etapa 4: vrácení k přepracování, známka rodiči (DB, samostatné schválení)

## Výběr lekcí jako zdroje (19. 11.)
- [x] Diagnostika na datech Tyny
- [x] Sdílené načítání lekcí a napojení výběrů lekcí pro AI a hry
- [x] Prázdný stav, seskupení, bez tichého ořezu, testy, 390 px

## Studio – etapy 0 a 1 (schváleno Tynou)
- [x] Etapa 0: jednotný vstup zdrojů (text, soubory, galerie, foťák, odkaz, lekce), funkce fetch-source-url, průvodce aktivit bez tichého ořezu; „Vytvořit z lekce“ už opraveno dříve.
- [x] Etapa 1: Aktivita z vlastního materiálu – AI návrh sady smíšených kroků, zaškrtnutí a úprava (čas, body, obrázek, vysvětlení, obsah), vložení až po potvrzení.
- Neověřeno: živá AI, načítání skutečných webů, prohlížeč 390 px (přihlášení se přesměrovalo), telefony. Nenasazeno.
- Etapa 2 (vložení sady do lekce a tisk) – neimplementováno; samostatná kola a menu Studio jsou v dalších etapách.

## Studio – etapa 3: samostatná kola (schváleno)
- [x] Opraven limit AI kroků a samostatná volba/limit hotových aktivit z lekce; etapa 2 neprovedena.
- [x] Jednotný model samostatného kola, volba rozpadu pro staré sady, čas a souhrn sady.
- [x] Telefonní hráč, projektor, průběh hotovo, řešení a hromadné výsledky.
- [x] Serverové bodování podílu, týmy a bezpečné chování režimů Závod/Krádež.
- [x] 128 logických/regresních + 4 komponentové testy, typy a build; celá sada 1345/1352 se 7 staršími nesouvisejícími chybami. Bez migrace a nasazení.
- Neověřeno: ostrá serverová funkce, hra se dvěma telefony, skutečný projektor a zátěž. Stará sada „Hovězí maso“ zůstává při přímém spuštění historicky rozložená; nové kolo se u ní volí v sestavovači.

## Živá hra – barvy Pravda/Nepravda
- [x] Sdílené rozpoznání přesných dvou možností; Pravda modrá, Nepravda červená, ostatní MCQ a data beze změny.
- [x] Projektor, telefon, učitel, výsledky a stará cesta /hra; text a tvary zachovat.
- [x] 9 rozšířených testů + 46 regresí, typy a build. Bez DB a nasazení; reálný projektor a telefon vizuálně neověřeny.

## Demo kontakt – D−0, pražská půlnoc a závěrečný e-mail
- [x] Ověřena jednorázová nepovinná nabídka až po prvním vlastním obsahu; ruční otevření zůstává dostupné.
- [x] Texty D−0 a „dnes o půlnoci“; schválený souhlas v2 pro nové kontakty, uložené v1 beze změny a bez závěrečné zprávy.
- [x] Připraven závěrečný e-mail pouze pro souhlas v2, po úklidu, jediný pokus a výmaz kontaktu i starých demo logů.
- [x] Schválené SQL `supabase/proposals/demo_d0_final_notice.sql` aplikováno 21. 11. jako `0096_demo_d0_final_notice`; předem ověřena shoda `demo_purge_pair` kromě podmíněného kontaktu v2.
- [x] Čtecí kontrola: všech 5 požadovaných funkcí a `demo_purge_pair` existují, 10 dem má platný budoucí termín, 0 kandidátů a 0 předčasných kandidátů úklidu; žádné demo nebylo smazáno.
- [x] 45 aktuálních cílených testů v 6 souborech a automatický build prošly; letní/zimní přepočet ověřen čtecím dotazem. Bez odeslání e-mailů a nasazení.
- [x] Schválené znění v2, rozlišení připomínek v1/v2, dialog a zásady.
- [ ] Po nasazení funkcí a samostatném schválení aplikovat cron návrh: připomínky 05:00 UTC, úklid 04:00 UTC. Návrh zatím NEAPLIKOVÁN; živý úklid zůstal 03:00 UTC.
- Neověřeno: přímé spuštění servisních/auth RPC čtecím účtem (oprávnění záměrně beze změny), skutečné odeslání, doručení, cron a úklid.

## Demo – plán ochrany a limitů
- [x] Plán uložen (`.lovable/plan.md`); nic neimplementováno.

## Demo pruh – sbalení a čipy limitů
- [x] Sbalení na 5px proužek + záložka „Demo", paměť v localStorage, vynucené rozbalení ≤ 3 dny / vyčerpaný limit / po prodloužení; skryto při tisku.
- [x] Čipy z `get_my_demo_limits()`, hláška po 429 z jakékoli AI funkce (centrální sledování jen u dema).
- Čeká na schválení: SQL `supabase/proposals/demo_my_limits_rpc.sql` (bez něj se čipy nezobrazí, hláška po 429 funguje).

## Žákovský přehled – etapa 1 (schváleno)
- [x] Ověřeno: Dnes už načítá všechny hodiny dne včetně proběhlých; upraveno jen zobrazení, ikony a aktuální hodina.
- [x] Čtvercový avatar 96 px/radius 8 px jen na přehledu; 6 hlavních a 6 kompaktních dlaždic, původní cesty, počty z existujících dat, profil a widgety zachovány.
- [x] 17 cílených testů v 6 souborech a typy prošly; build OK. Živý náhled na desktopu, 390 px a 360 px bez vodorovného posunu; dyslexie, řádkování, reduced motion, Space/Enter a shoda počtu úloh ověřeny.
- „Moje předměty“ záměrně bez dlaždice: žákovská seznamová stránka neexistuje. Navržen jednoduchý seznam z dostupných učebnic/rozvrhu k samostatnému schválení.
- Neověřeno na reálné právě probíhající hodině (stav pokryt testem); skutečný iPhone Safari neověřen. Bez DB, SQL, edge funkcí a nasazení.
- Etapa 2 (cesta s denním cílem v Učím se) NESCHVÁLENA – nedělat.

## Učitelský přehled – etapa U1 (schváleno)
- [x] Sdílet komponentu dlaždic a tokeny se žákovským přehledem, bez dvou verzí.
- [x] Seskupit dlaždice, zachovat všechny cesty/role a omezit dnd-kit na přesuny uvnitř skupiny; migrace v1 → v2.
- [x] Dnes, široké dlaždice, Pro mě a profil; cílené testy, typy a živá kontrola mobilu.
- 41 cílených testů, typy a build OK; živě všech 16 cest, avatar 96 px/8 px, ikony 30 px, mobil 360 px bez posunu.
- Neověřeno živé tažení a lektor; skutečná právě probíhající hodina nebyla v účtu. Ke kontrole nemá dostupný počet. Bez DB, SQL, edge funkcí a nasazení.

## Sdílené dlaždice – vizuální doladění žák + U1
- [x] Kompaktní obsahové dlaždice 128 px, radius 16 px, auto-fit/dense a široká Učím se podle 420 px.
- [x] Přesné funkční barvy s minimální korekcí kontrastu, ikona/název/popisek pod sebou; druhá řada beze změny.
- [x] Testy, typy a screenshoty žáka i učitele při 1360/390 px. Bez DB, SQL, edge funkcí a nasazení.
- 30 testů, typy a build OK. Žák 1360 px: dvě plné řady, Rozvrh doplňuje druhou; 390 px: tři dvousloupcové řady. Učitel sdílí vzhled i funkční barvy, široké dlaždice vedle sebe.
