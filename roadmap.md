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

## Žák – Moje předměty (etapa 1b)
- [x] Diagnostika stávajících čtení členství, předmětů, rozvrhu, úloh a jmen učitelů; jména učitelů žákovské RLS nepovoluje, karty proto ukazují jen třídu/skupinu.
- [x] Chráněná `/student/predmety`, karty tříd/skupin, prázdný stav a dlaždice přehledu; Rozvrh i nová stránka sdílí jedno čtení členství a slotů, staré cesty zachovány.
- [x] 21 cílených testů, typy a build OK; živě 24 karet, další hodiny/štítky, původní Rozvrh, 1360/360 px bez posunu a bez chyb stránky. Bez SQL, DB/RLS a nasazení; skutečný iPhone Safari neověřen.

## Žákovský přehled – dokončení a klikací úlohy (schváleno)
- [x] Hlavička se sérií a úrovní; Dnes s celým rozvrhem a datovými pilulkami; bez karty Nejbližší úkoly u žáka.
- [x] Po dlaždicích jen kompaktní Můj profil a Můj pokrok z existujících dat; ostatní zdroje ponechat mimo přehled.
- [x] Sdílená karta úlohy otevře detail klikem i Enter/Space; vnořené akce zůstanou samostatné v seznamu i předmětech.
- [x] 25 cílených testů, typy a build; živý přehled 1360/390 px, Enter v seznamu i předmětu, bez vodorovného posunu a chyb stránky. Bez DB, SQL, edge funkcí a nasazení.
- Denní cíle nemají existující datový zdroj, proto zůstal původní popisek Učím se. Živý účet neměl data pro pilulky Dnes; jejich stavy pokrývají testy. Skutečný iPhone Safari neověřen.

## Učím se – etapa 2, varianta D (schváleno)
- [x] Uvítací denní cíl z dokončeného procvičování, XP, série a zvládnutí témat z existujících dat.
- [x] Dnešní mise podle posledních/slabých lekcí a režimy podle záměru; zachovat kartičky, kvíz, shrnutí, chat i materiál.
- [x] Lidské názvy studijních technik s původním názvem jako nápovědou; beze změny spouštění a funkcí.
- [x] Moje cesta podle zvládnutí lekcí, mobilní vzhled, kontrast a reduced motion.
- [x] 62 testů, typy a build; živě 1360/390 px, kvíz, chat, techniky, skutečná data, bez přetečení a chyb. Bez DB, SQL, edge funkcí a nasazení.
- XP odměny misí nejsou přidány: dokončené procvičování dnes XP nepřipisuje a bezpečná serverová odměna by vyžadovala samostatnou změnu. Živé AI volání nebylo spuštěno; kartičky/shrnutí ověřují komponentové testy, chat bylo ověřeno pouze otevření.

## Ke kontrole – dávkové načtení příloh a poznámky
- [x] Přílohy všech zobrazených úkolů se načítají jedním dotazem; panel dostává poznámku i soubory všech členů skupinového odevzdání.
- [x] 18 cílených testů, typy a build prošly; živá obrazovka při 390 px ukázala přílohu i poznámku bez vodorovného posunu a chyb stránky. Bez SQL, změn oprávnění a nasazení.

## AI návrh hodnocení – etapy 1 a 2
- [x] Textový návrh v Ke kontrole a detailu úkolu ze zadání, odpovědi, poznámky, skóre a příloh; pouze předvyplnění bez AI příznaku.
- [x] Stejná funkce má oddělený strukturovaný režim bodů s validací maxima a zdůvodněním; původní portfolio a demo/429/402 chování beze změny.
- [x] 41 cílených testů, typy, Deno kontrola a build prošly; oba panely i body při 390 px s maketou AI, nula automatických zápisů a přetečení. Bez DB a nasazení.
- Neověřeno živé AI volání a ostrá funkce před nasazením; skutečné odevzdání ani notifikace nebyly změněny.

## Barevné nálady – etapy 0 a 1
- [x] Tokeny Bezli/Minimal/Natural, synchronní start a localStorage s resetem při odhlášení či změně uživatele; bez DB.
- [x] Sekce Vzhled ve společném profilu včetně dema, tři přístupné náhledy a okamžité přepnutí.
- [x] 48 testů, typy a build; kontrast všech dlaždic, nové texty AA, stavové/herní tokeny beze změny. Bezli zachovává dnešní baseline. Živě 390 px: klávesnice, reload, reset a nulový horizontální posun.
- Neověřeno na skutečných účtech všech rolí a v demu; sdílí stejnou profilovou kartu. Bez dalších nálad, tmavého režimu, SQL a nasazení.

## Barevné nálady – doplnění pěti palet
- [x] Přidat Cute, Ocean, Plum, Sunny a Calm do tokenů, náhledů, profilu a synchronního localStorage; neplatná hodnota = Bezli.
- [x] Ověřit kontrast všech osmi nálad, neměnnost stavových/herních barev, výběr/uložení a mobilní klávesnicové ovládání; bez DB a nasazení.
- 11 cílených testů prošlo; živě všech 8 voleb mezerníkem, uložení/reload, neplatná hodnota = Bezli, 2 sloupce při 390 px a 4 na desktopu, bez posunu a chyb stránky.

## Platformové bannery – limit 6 a načtení 9 (schváleno)
- [x] Nová migrace 0098 mění pouze `tg_banners_guard` (3 platformové limity 6) a `get_my_banners` (`LIMIT 9`); školní limit 3 a ostatní těla beze změny.
- [x] SELECT po aplikaci potvrdil nové hodnoty a zachované SECURITY DEFINER/STABLE/search_path; žádné změny tabulek, RLS, triggerů ani dat.
- [x] Obecná chybová hláška, test 6 a ověření 9 bannerů v kolotoči při 390 px; bez nasazení.
- 20 testů prošlo; živá maketa 9 bannerů má 9 teček a funkční devátou volbu, ovládání 344 px v panelu 358 px, bez vodorovného posunu a chyb stránky. Školní text limitu 3 zůstal beze změny.

## Učím se – název kvízu a vyhledávání lekcí
- [x] Přejmenovat „Zkus se z toho“ na „Vyzkoušej se z toho“ v dlaždici/aria i testech; Rychlý kvíz zůstává.
- [x] Sdílený combobox pro kartičky a shrnutí: hledání bez diakritiky v názvu/předmětu/učebnici, naposledy procvičované lekce první, prázdný stav, klávesnice a mobil 390 px; bez DB/RLS a nasazení.
- 9 testů prošlo; živě 22 lekcí, hledání 3 shody, přesný prázdný stav, šipky/Enter/Escape, výběr a maketované kartičky, min. dotykový cíl 50 px a nulový horizontální posun. Skutečná mobilní klávesnice ani ostré AI nebyly spuštěny.

## Sjednocení na SearchableSelect + audit dlouhých výběrů
- [x] LessonSearchCombobox odstraněn; StudyLessonActionDialog a StudentMethods používají přímo SearchableSelect při zachování cache, skeletonu a retry.
- [x] SearchableSelect má nepovinné skupiny, hledání v group/subtitle, připnutou první volbu, načítání/chybu, triggerLabel a stávající mobilní/klávesnicové chování; výchozí chování starých použití beze změny.
- [x] Kvíz, test, Můj materiál a Zedík nemají vlastní rozbalovací výběr lekce; používají poslední lekci nebo samostatný postup, proto se neměnily.
- [x] 65 testů prošlo; typy/build a živé dialogy při 390×500 prošly bez překrytí či vodorovného posunu. Skutečná mobilní klávesnice, ostré AI a spuštění procvičování neověřeny.
- [x] Audit 41 dalších souborů s prostým Select a potenciálně dlouhými datovými seznamy je předán pouze ke schválení; kandidáty nebyly přepsány. Odhady jsou rozsahy podle zdroje dat, ne přesné počty konkrétního účtu.

## Učím se – skupiny lekcí a delší výběry sešitů
- [x] Sdílený combobox v „Procvičit metodou“: „Bez konkrétní lekce“ vždy první, nadpisy předmětů i po filtrování, prázdné skupiny skryté.
- [x] Hledání bez diakritiky/velikosti v názvu lekce, učebnice i předmětu; vlastní posun a výška/otvírání podle visualViewport nad mobilní klávesnicí.
- [x] Sešit a stránka používají sdílený SearchableSelect až od 8 položek; kratší Select beze změny.
- [x] 36 cílených/regresních testů, typy i build prošly. Živě 22 lekcí ve 5 předmětech, filtry/prázdný stav, první volba a 390×500 bez překrytí či vodorovného posunu. Skutečná mobilní klávesnice a živých 9 sešitů/stránek neověřeny; bez DB a nasazení.

## Učím se – sdílená cache a rychlejší načtení lekcí
- [x] Sdílený react-query hook s userId, staleTime 5 min a gcTime 30 min; prefetch v „Učím se“ i na žákovském přehledu, stejná data používá i tahák.
- [x] Společný combobox i v „Procvičit metodou“, skeleton při prvním načtení, přesná chyba a funkční „Zkusit znovu“.
- [x] Nezávislé dotazy a vazby skupin/umístění běží souběžně; doplňování učebnic jen při potřebě, stejné RLS/publikace/seskupení a 22 dostupných lekcí v preview.
- [x] Test cache bez nových dotazů při druhém otevření, skeletonu a retry; typy a regrese. Preview před: 11 vln/22 dotazů a 1,48–1,50 s při každém otevření; po: 9 vln při prefetch, 0 dotazů a 0,46–0,68 s při otevření. Mobil 390 px bez horizontálního posunu, živá chyba i retry ověřeny; bez DB/SQL a nasazení.

## Učím se – přepínač předmětů a příprava na test
- [x] Cesta: všechny předměty, výchozí poslední předmět a bezpečné localStorage podle userId; fokus/scroll z dlaždice.
- [x] Řazení podle existujícího sort_order učebnice/tématu, jinak abecedně; Ostatní mají SearchableSelect vždy a dlouhé seznamy se rozbalují po 8.
- [x] Test: existující lesson_id/settings.lessons filtrované přes dostupné žákovské lekce; 10/15/20 minut a nejslabší lekce, jinak původní 5minutový fallback. Bez testu text „Žádný test na obzoru“.
- [x] 45 testů, typy/build a živá kontrola mobilu 390 px: 5 předmětů, uložení/reload, fokus, Ostatní se 7 lekcemi a 3 vyhledané shody, bez přetečení a chyb stránky. Ostré spuštění procvičování/AI neověřeno; bez DB/RLS/SQL a nasazení.

## Učím se – fallback názvu předmětu ze slugu
- [x] Chybějící label `textbook_subjects` nahrazuje pouze zobrazovací `practiceSubjectLabel`: 7 schválených českých názvů, katalogový label má přednost, neznámý slug se zpřehlední a „Ostatní“ je jen bez slugu. Bez zápisu do DB.
- [x] 28 testů mapování, `groupPracticeLessons`, overview, cache i domovských režimů a typy prošly. Živé preview při 390 px ukazuje samostatnou Administrativu, Adresy - úvod i Archivace a skartace písemností; bez vodorovného posunu a chyb stránky.
- Chybějící labely pro Tynu: `administrativa` → Administrativa; `informacni_a_komunikacni_technologie` → Informační a komunikační technologie; `maturitni_otazky` → Maturitní otázky; `ekonomika` → Ekonomika; `zaklady_prava` → Základy práva; `predmet_na_zkousku` → Předmět na zkoušku; `stolniceni` → Stolničení.

## Bezlai tutor – volný režim a RAG nad materiály žáka
- [x] Přejmenovat dlaždici na „Zeptej se Bezlai“ a oddělit výchozí kontextový režim od volného (`mode`), včetně úvodu a promptů; AI odhalení zůstane.
- [x] Ve volném režimu prohledat pouze zdroje čitelné JWT žáka, bez diakritiky, max 5 × 800 znaků, s názvy zdrojů, prázdným stavem a čitelnou chybou; demo limity beze změny.
- [x] Testy promptů, normalizace, RLS/token scopu, chyb a stávajících kontextových volání; roadmapa, bez SQL/nasazení.
- Prohledávají se nejvýše 80 nejnovějších publikovaných lekcí z každé lekceové tabulky a vlastní poznámky z max. 20 sešitů/100 stránek; dočasný text „Z materiálu“ se neukládá, proto jej zpětné hledání nezahrnuje. Nové SQL není potřeba.
- Původní kontrola: 25 cílených testů a typy prošly; preview při 390 px ověřilo režim, úvod a chybu hledání s maketou bez ostrého AI, bez vodorovného posunu a chyb stránky.

### Bezlai – dokončení po doplnění kreditů
- [x] Backendový test převeden na nativní Deno runner: 7/7 prošlo; 18 frontendových regresí a typy rovněž prošly. Bez nasazení.
- [x] Živé preview s JWT přihlášeného účtu a dočasným lokálním můstkem nad stejnými search/prompt moduly: „hovězího masa“ i „hovezi maso“ posílají `mode: free` a prázdný vynucený kontext; obě AI odpovědi citují „Hovězí maso“, žádná mediální výchova.
- „hovězího masa“: 5 úryvků – 2× Hovězí maso (800+800 znaků), Vykosťování a práce s masem v předběžné přípravě (800), Zvěřina (800), Skopové maso (800).
- „hovezi maso“: 5 úryvků – 2× Hovězí maso (800+798), Úvod maso (800), Vepřové maso (800), Skopové maso (799). Obsah úryvků se nezapisuje do logu ani roadmapy.
- [x] Kontextový režim živě v lekci i rozpracovaném úkolu: `mode: context`, původní úvod, odmítnutí přímé odpovědi a vodítko podle zadání; bez odevzdání či úpravy odpovědí.
- Ostrá nasazená funkce se záměrně nespustila ani nezměnila; lokální můstek pouze pro non-demo ověření použil skutečné RLS čtení a AI. Prázdný stav a označení obecné odpovědi kryjí backendové testy.
- [x] Návrh „Můj materiál“ ke schválení: výslovně opt-in uložení extrahovaného/potvrzeného textu pod vlastnictvím žáka s názvem, typem zdroje, verzí souhlasu a možností kdykoli text smazat; samostatná tabulka s owner-only RLS pro čtení i zápisy, demo omezení a kvóty. Bezlai by tyto řádky četla stále jen JWT žáka. Rozsah M (cca 1,5–2,5 dne): UI souhlasu/správy, migrace a RLS, napojení hledání, testy soukromí a mobilu. Žádné SQL navrženo ani aplikováno.

## Bezlai – dočasný materiál a shrnutí do výukových pomůcek (schváleno)
- [x] Sdílený vstup materiálu z procvičování pro volný režim: vlastní text, PDF/TXT, max. 6 fotek s kontrolou AI přepisu a stránka vlastního sešitu; jen paměť konverzace, limity a texty soukromí beze změny.
- [x] AI shrnutí konverzace do upravitelného pole; ručně potvrzené uložení do sešitu (včetně nového), portfolia nebo předání do procvičování, bez automatických zápisů. AI štítky a označení následné ruční úpravy jsou zachované.
- [x] Čitelné chyby s retry a bez ztráty textu, demo pravidla, klávesnice/ARIA/mobil 390 px, testy; bez DB/RLS/SQL a nasazení.
- Ověřeno: 104 frontendových a 9 backendových testů, typy/build; mobilní preview s mockovaným chatem a skutečnými zápisy/čtením `[TEST]` sešitu i portfolia, odkazy a předání do kartiček. Vlastní test data uklizena. Živá nasazená edge funkce, ostré AI, PDF/foto přepis a nativní mobilní galerie v tomto průchodu nebyly spuštěny.

## Bezlai – poctivé zdroje a ověření odpovědi (schváleno)
- [x] Oba prompty zakazují tvrzení o tréninku, knihách, webech a vymyšlené citace; otázka na původ odpovědi dostane pevné poctivé znění přímo ze serveru, bez AI.
- [x] Server vrací skutečně použité `sources` a `grounded`; aplikace pod každou vygenerovanou odpovědí ukazuje zelený zdrojový nebo žlutý obecný štítek s ikonou, textem a dostupnými odkazy na lekce/sešit.
- [x] Pevný návod „Jak si to ověřit“ v hlavičce a u obecné odpovědi, s existujícím hledáním lekcí a odkazy na sešity/Můj materiál; texty jsou v `bezlai-verification.ts`.
- [x] „Ověřit s učitelem“ používá stávající `messenger_contacts`, výběr z více učitelů a koncept pouze v `sessionStorage`; Zprávy otevřou existující konverzaci nebo kontrolovaný dialog nové, nikdy neodesílají samy. SQL není potřeba, demo tlačítko nemá.
- [x] Testy: 85 frontendových + 11 backendových, typy/build. Mobil 390 px ověřil zelený/žlutý štítek, návod, dva maketované kontakty a messenger s 0 POST zápisy a 0 chybami stránky; zelený odkaz otevřel skutečnou lekci. AI odpovědi v preview byly maketované, ostrá nasazená funkce se nespustila. Cílová stránka lekce má staré přetečení vlastní lišty nástrojů; nové obrazovky přetečení nemají.
- Jen návrh přísného režimu (neimplementováno): opt-in politika škola → třída/předmět, výchozí zůstane dnešní režim. Nová tabulka politik by držela `school_id`, volitelné `class_id`/`subject_id`, režim a autora změny; učitel by upravoval jen vlastní třídy/předměty pod pravidly školy, school_admin svou školu. Server by po JWT vyhodnotil nejpřísnější platnou politiku a povolené zdroje odvodil z existujících zařazení lekcí/učebnic třídy a školy; žákovy sešity by zůstaly owner-only. Čtení by stále šlo tokenem žáka přes RLS, bez service role; případný definer by vracel jen povolená ID, ne obsah. Vyžaduje samostatnou schválenou migraci, GRANT/RLS, UI nastavení a testy běžného i přísného režimu; odhad M/L, cca 2–4 dny. Bez této migrace se zdroje nedají spolehlivě omezit, proto se neskrývá za pouhý klientský filtr.

## Klikací karty učebnic – učitel a žák
- [x] Sjednotit otevření celé karty myší, Enterem i Mezerníkem bez spouštění z vnořených akcí.
- [x] Odstranit Detail z patky, zachovat kopírování kódu a menu; zalomit patku i dvouřádkový název.
- [x] Ověřit testy, typy a mobilní vzhled; bez DB, SQL, edge funkcí a nasazení.
- Živě při 390 px: 6 učitelských a 7 žákovských karet, bez vodorovného přetečení; kopírování a ⋮ nemění stránku, klik/Enter/Space otevírají detail, 0 chyb stránky. Skutečný iPhone Safari neověřen.

## Sdílené rozbalovací seznamy – rolování v dialozích
- [x] Reprodukováno v „Chci si to zapamatovat“: seznam 1 324/300 px se po wheel nepohnul (`scrollTop` 0 → 0). Příčinou byl portálový popover mimo povolenou posuvnou vrstvu dialogu.
- [x] `SearchableSelect`, SubjectPicker, témata ŠVP, výběr člena v pracovním úkolu a oba výběry publikace lekce používají `Popover modal`; výška, `overscroll-contain` a datové chování zůstávají beze změny. Radix Select už je ve výchozím stavu modální, proto zůstal beze změny. Informační popovery a seznamy mimo dialog se nemění.
- [x] Trvalý `e2e/popover_dialog_wheel.py` ověřil Shrnutí, Chci si to zapamatovat i Procvičit metodou: wheel 0 → 500 px, klik mimo, Escape jen popover, klávesnicový výběr a návrat fokusu. Dotyk při 390 px 0 → 135 px, bez vodorovného přetečení.
- [x] 12 souvisejících testů, typy, diff check a build prošly; nový lint problém nepřibyl (cílený lint hlásí jen dřívější `any`/Fast Refresh v legacy částech). Bez DB/RLS/SQL a nasazení.

## Náhled zadání a podklady AI u úkolů (schváleno, kroky 1–3)
- [x] 1) Žákovský náhled zadání (ikona oka v řádku, „Žákovský pohled“ v detailu), jen čtení, zkrácený výchozí stav.
- [x] 2) AI hodnocení dostává propojenou lekci (6 000 znaků) a materiály zadání (5 souborů / 8 MB / 15 MB) tokenem učitele jako podklad. Rubrika: k úkolu dnes není nijak navázaná – čte se jen `settings.criteria`; navázání rubriky vyžaduje volbu v editoru úkolu (bez SQL), ke schválení.
- [x] 3) Bezlai v úkolu: lekce + max. 2 textové materiály (PDF/TXT/DOCX) tokenem žáka, úryvky 5×800, štítky zdrojů.
- Ověřeno: testy, čtení tokenem učitele nad reálnými úkoly, mobil 390 px. Neověřeno: nasazené funkce a ostrá AI, čtení tokenem žáka (politika storage to povoluje přes `can_read_assignment_material`).
- [ ] 4) Vlastní podklad v CreateFromLessonDialog – NEDĚLAT (rozhodnutí Tyny).

## Interní Vyhodnocení žáka – schválené etapy 1 a 3
- [x] Etapa 1: čisté `evaluation.ts` sdílí pravidla nejlepších pokusů/aktivit a silných/slabých stránek; úkoly, aktivity, procvičování i mastery po lekcích/tématech, úkoly bez lekce pod předmětem, trend, počty podkladů a šablonový souhrn bez AI.
- [x] Panel jen ve `TeacherResults` a v detailu žáka ve `ClassResultsManager`; vlastní úkoly učitele a jejich příjemci, SearchableSelect, čtení přes stávající RLS. Žákovský ani rodičovský frontend se neměnil, export se nepřidal.
- [x] Etapa 3: dočasné AI „Co opakovat“ s 3–5 povolenými tématy, důvodem a existujícím procvičováním; kopírování/zavření, štítek AI, žádné uložení. Server ověřuje vlastnictví úkolu a příjemce tokenem učitele, demoAiGuard a serverovou bílou listinu témat; do AI jdou jen „Žák A“, předmět a čísla.
- [x] Nová data po datu návrhu ukážou „Data se změnila, navrhni znovu“ v rámci relace; nic se neukládá.
- Ověřeno: 21 frontendových testů, 5 Deno testů promptu, typová kontrola edge funkce, automatické sestavení a mobil 390 px se skutečnými čtecími daty. Maketované AI volání mělo 5 číselných témat bez jména/e-mailu/třídy/odpovědí, zobrazilo 3 návrhy a odkazy; detail žáka se otevřel a Escape jej zavřel, vodorovné přetečení 0 px. Neověřeno: ostrá AI a nasazená edge funkce (nenasazeno).
- Etapy 2 a 4 NEDĚLAT bez schválení SQL.

### Etapy 2 a 4 – pouze popis SQL ke schválení, NEAPLIKOVÁNO
- V budoucí migraci by vznikla append-only tabulka `teacher_student_evaluations`: `id`, `student_id`, `subject_id`, `scope_type` (class/group), `scope_id`, `author_id`, `kind` (conclusion/note), `text`, `source` (teacher/ai_draft/ai_edited), `data_snapshot`, `based_on_until`, `supersedes_id`, `created_at`. Oprava závěru = nový řádek s odkazem na předchozí verzi; učitelé nemají UPDATE ani DELETE. Poznámky učitele použijí `kind='note'` a vstoupí do dalšího AI konceptu jen po akci učitele.
- RLS by povolilo SELECT/INSERT jen přes jednu SECURITY DEFINER funkci `can_access_student_evaluation(scope_type, scope_id, subject_id)`, nyní pouze učiteli vlastnícímu úkol pro daného žáka/předmět/rozsah; INSERT navíc `author_id=auth.uid()`. Žák, rodič a anon nemají politiku. GRANT jen authenticated/service_role, RESTRICTIVE demo guard/izolace; případné GDPR smazání jen adminem.
- Budoucí třídní učitel/vedení se doplní jen do pomocné funkce (vedení např. read-only), bez přestavby tabulky a politik; případné skrytí poznámek by použilo `audience` s výchozím `subject_teacher`. Tento popis není migrace a nebyl proveden.

## Pracovní list z vlastního materiálu (21. 11. 2026)
- [x] Sdílený výběr „Z lekce / Vlastní materiál / Obojí“ (`LessonOrOwnSourcePicker`, `lesson-or-own-source.ts`) v editoru listu a v „Vytvořit z lekce“; materiál se neukládá, bez DB/RLS.
- [ ] Uložení materiálu k listu pro AI opravu – čeká na rozhodnutí Tyny.

## Vlastní materiál – formáty (doplnění)
- [x] PDF (skeny → „Zpracovat stránky jako fotky", max 6), DOCX/PPTX/XLSX/ODT/ODP čteny v prohlížeči, DOC heuristika, PPT/XLS/ODS/RTF rada „uložte jako…"
- [x] Odkazy: cloudové školní odkazy odmítnuty předem, české hlášky s návodem pro všechny kódy
- [x] Fotky s náhledem, limity zobrazeny předem, stav načítá se/hotovo/chyba
- [ ] Ruční průchod v náhledu s přihlášeným učitelem a ostrou AI (neověřeno)

## Editor prezentací – etapy 0 a 1 (plán prezentace-editor-canva-2026-11-21)
- [x] Etapa 0: knihovna her v „Přidat snímek“, jeden zdroj pravdy aktivity, AI aktivita podle typu, náhled aktivity na plátně, vložení do slidu, Z lekcí (vnořené, stránkování) + Ze Studia, spuštění jako Studio (rozložení kvízu, body, týmy, hlášení), varování před zavřením, testy toku
- [x] Etapa 1: Spustit v seznamu, horní lišta promítání (Předchozí/číslo/Další, klávesy), Nástroje do hodiny v každém promítání, úprava propojené prezentace přes kopii s odkazem na lekci
- [ ] Ruční průchod klikáním v editoru a živá hra s telefony (neověřeno)
- [ ] Etapy 2–5 čekají na zadání
- [x] Čitelnost karty aktivity na tmavých slidech, barvy aktivity s kontrolou kontrastu, editor prázdného kvízu/ankety, pravý panel vlastností, hlášky co chybí
- [ ] Jednotný editor aktivit – plán v .lovable/plan/jednotny-editor-aktivit-2026-11-21.md, čeká na schválení

## Etapa 2 – editor prezentací jako Canva
- [x] Rozdělit editor na menší moduly bez odebrání funkcí.
- [x] Horní lišta, čtyři záložky levého panelu a dostupné šablony.
- [x] Plátno s kontextovými akcemi, pravý panel vlastností a pás miniatur.
- [x] Dotykové ovládání a zmenšená okna.
- [x] Testy rozvržení a regresní testy editoru.
- [x] Proklikat hlavní tok v náhledu, zkontrolovat sestavení a commitnout.
- Ověřeno: 76 testů, typy a build; desktop 1440×900, tablet 1024 px včetně dnd a mobil 390 px. Vlastní [TEST] prezentace smazány; bez DB/RLS a nasazení.

## Jednotný editor aktivit – etapy 1–3
- [x] Kanonický ActivityModel a bezeztrátové adaptéry Studio / blok / slide.
- [x] Sdílený obsahový editor včetně prázdného kvízu, více otázek, mraku a textového obsahu herních typů.
- [x] Sdílený čas, body, jednotlivě/týmy, obrázek, vysvětlení a barvy ve Studiu, lekci i prezentaci.
- [x] Klikací průchod Studia a prezentace, uložení/znovuotevření, živá hra a PDF pokud dostupné.
- [x] Finální regresní testy, typy, build, úklid vlastních [TEST] dat a commit.
- Ověřeno: 214 testů, typy/build; Studio i prezentace uloženy a znovu otevřeny, PDF vizuálně čitelné, živá hra a otázka na telefonu. Odpověď žáka po vypršení limitu neověřena. Vlastní [TEST] data a hra odstraněny; bez DB/RLS a nasazení.

## Prezentace – etapa 3 a dokončení editoru aktivit
- [x] Seskupený katalog všech aktivit a dialog Vložit aktivitu se čtyřmi cestami, AI schválením a živým náhledem.
- [x] Výběr a bezeztrátové vložení více slidů z lekcí a vlastních prezentací.
- [x] Doplnit bezpečné specializované editory a tisk aktivity/slide.
- [x] Testy, klikací průchod včetně živé odpovědi a bodování, úklid [TEST] dat a commit.
- Ověřeno: typy, 291 souvisejících testů; skutečná AI z materiálu, kopie slidu mezi prezentacemi, PDF, živá odpověď, 100 % správně a 985 b. Vlastní [TEST] prezentace, hra, hráč i odpověď odstraněny; bez DB/RLS a nasazení.

## Prezentace – etapa 4: věrný import a export
- [x] PPTX: pozadí/motivy, textové styly, tvary, obrázky, pozice, skupiny a poznámky; záložní textový import při chybě.
- [x] PDF: stránky jako pozadí, volitelná upravitelná textová vrstva a srozumitelné limity.
- [x] PPTX export: slidy, prvky, aktivity, poznámky; společná nabídka PPTX/PDF/tisk.
- [x] Testy vzorových souborů, round-trip, 20slidová deka, editor a PDF, úklid [TEST] dat.
- [ ] Projekci importovaného slidu ověřit po úspěšném připojení testovacího hráče (v tomto průchodu zůstala v lobby).

## Prezentace – etapa 5: šablony a motivy
- [x] Jednáct živě náhledených upravitelných šablon slidů a tři nové Bezli sady; původní sady zachovány.
- [x] Bezli gradient, tmavý, světlý a krémově pruhovaný motiv; kontrast a barvy aktivit.
- [x] Vlastní slide/prezentace jako šablona v existujícím lokálním úložišti konkrétního učitele; bez DB/RLS.
- [x] Vložení za aktuální slide, potvrzení náhrady celé prezentace, historie a zachování obsahu.
- [x] Finální regresní testy, vizuální průchod, úklid [TEST] dat a commit.
- Ověřeno v přihlášeném náhledu: 11 šablon, 7 celých sad, nové motivy, kvíz, vlastní šablona, zrušení/potvrzení náhrady a uložení. Vlastní [TEST] prezentace odstraněny; bez DB/RLS a nasazení.

## Etapa 5 navazující: úspora místa a oprava importu PPTX
- [x] Kompaktní horní lišta a jedna kontextová lišta nad plátnem bez zalomení.
- [x] Užší sbalitelné panely s pamatovaným stavem; skrývací miniatury s navigací a autofitem.
- [x] PPTX pozadí ze slidu/layoutu/masteru (solidFill, blipFill, bgRef) a věrný přepočet písma/cap.
- [x] Testy, notebook 1366×768 a tablet 1024, vlastní 20slidový PPTX, úklid [TEST] dat a commit.
- Ověřeno 28 testů, typecheck a přihlášený průchod: 34 pt = 57 px, 12 plných a 8 obrázkových pozadí, poznámky, zaoblené tvary, jednořádková lišta, miniatury, trvalé volby a 44px dotyk. Plátno po sbalení 1081×608 px; tablet 964×542 px. Vlastní prezentace a importované obrázky odstraněny; bez DB/RLS a nasazení.

## Prezentace – viditelné a bezpečné ovládání slidů
- [x] Diagnostikovat neviditelné smazání v současné a starší verzi editoru.
- [x] Akce miniatur: smazat, duplikovat, přesunout, skrýt; kontext, dotyk, klávesy a vícenásobný výběr.
- [x] Smazání se Zpět, ochrana posledního slidu, potvrzení hromadného mazání, varování aktivity a koš při skrytých miniaturách.
- [x] Zachovat lessonRef a lokální změny až do uložení; testy, přihlášený průchod, úklid a commit.
- Smazání existovalo jako `deleteCurrentSlide`, ale až v sbaleném panelu „Další prvky a akce“; funkce vznikla při etapě 2 (`743e1de9`), nešlo o odstranění staršího tlačítka.
- Přesun drag-and-drop už se neukládá automaticky; všechny změny slidů čekají na Uložit. `lessonRef` se přenáší na první slide. Skryté slidy vynechává živá příprava.
- Ověřeno 34 testů, typecheck, build a přihlášený průchod: aktivita+Zpět, hromadná duplikace/mazání, zrušení/potvrzení 5 slidů, Delete, kontext, oba přesuny, skrytí, koš po sbalení, uložení/znovuotevření. Bez chyb prohlížeče; vlastní `[TEST]` data odstraněna.

## Prezentace – přechody mezi slidy a návrh animací prvků
- [x] Přechody na jednotlivých slidech: katalog, směr, délka, použití na všechny a zpětná kompatibilita.
- [x] Akce + a přechod mezi miniatury, existující cesty vložení a ovládání při skrytém pásu.
- [x] Projekce učitele i žáka, reduced motion, PPTX import/export a souhrn aproximací.
- [x] Cílené testy, přihlášený průchod, úklid vlastních [TEST] dat a commit; bez DB/RLS a nasazení.
- [x] Pouze návrh animací prvků uložen do `.lovable/plan/animace-prvku-2026-11-22.md`; neimplementován.
- Deset přechodů včetně cut; směr push/wipe, délka 0,2–2 s. Vstup patří na N+1, globální volba zůstala. Rozložené otázky animují jen první vstup.
- Ověřeno 188 souvisejících testů, typecheck a přihlášený průchod: + mezi slidy, všechny čtyři cesty vložení v testu, posun dolů 1,2 s, použít na všechny, uložit/znovu otevřít, kompaktní lišta, tablet 1024, PPTX XML. Projektor i telefon 1,2 s a reduced-motion `none`; slide 2/3 synchronizovaný; bez chyb prohlížeče.
- Vlastní `[TEST]` prezentace a všechny relace s týmž označením odstraněny. Nativní PowerPoint/LibreOffice a fyzický telefon nebyly spuštěny; některé efekty se v PPTX nahrazují nejbližší variantou a délka rychlostí fast/med/slow.

## Prezentace – přesný panel přechodů podle Canvy
- [x] Nahradit katalog přesnými 10 dlaždicemi ve 3 sloupcích, ikonami, zavřením a Bezli výběrem.
- [x] Implementovat circle/color/line/match/flow/stack/slice v editoru, projekci a telefonu; zachovat cut/fade/push a reduced motion.
- [x] Match & move pro shodné pojmenované prvky s fallbackem na prolnutí.
- [x] Rozšířit PPTX mapování a souhrn aproximací a doplnit testy.
- [x] Přihlášený průchod editoru ověřil všech 10 voleb, uložení a znovuotevření. Živá projekce/telefon zůstávají neověřené kvůli opakovanému vypršení testovací relace.
- [x] Odstraněno přesně 9 vlastních [TEST] prezentací a 4 relace; bez DB/RLS změn, nasazení a změny AGENTS.md. Část B zůstává jen plánem.
