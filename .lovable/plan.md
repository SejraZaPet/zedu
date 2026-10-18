# Nástroje do hodiny – hotová Etapa A a návrh Etapy B

## Co je hotové
- Stránka `/ucitel/nastroje`, odkaz v učitelské navigaci a karta přehledu.
- Odpočet s předvolbami, vlastním časem, pauzou, resetem, ubývajícím barevným pruhem a vypínatelným zvukem.
- Stopky s mezičasy; losování bez opakování; náhodné skupiny podle počtu skupin nebo lidí.
- Megatext s automatickou velikostí a barevnými volbami; lokální měřič hlasitosti s citlivostí a prahem.
- Velké zobrazení, celá obrazovka a zavření Escape. Jména ani zvuk nástroje neukládají; zvuk nikam neposílají.
- Plán hodiny zůstal beze změn. Nebyla provedena žádná migrace ani změna stávajících herních funkcí nebo oprávnění.

**Ověření:** všech 532 testů prošlo; přihlášená učitelka použila šest nástrojů na velké obrazovce i v rozměrech telefonu. Ověřeno načtení oprávněné třídy, losování, skupiny, mezičasy, konec odpočtu, celá obrazovka a Escape. Mikrofon vyzkoušen se simulovaným vstupem prohlížeče. Vlastní označené demo vidělo jedinou vlastní třídu a losování fungovalo; po zkoušce odstraněn pouze vlastní pár, jeho obsah a dva účty. Žádné osobní údaje nebyly vypisovány.

**Ručně vyzkoušejte:** telefon a skutečný projektor, čitelnost z poslední lavice, slyšitelnost koncového zvuku, povolení i odmítnutí skutečného mikrofonu, losování z Vaší třídy a skupiny, zavření Escape. Skutečný mikrofon ani fyzický projektor zatím nejsou ověřeny.

## Diagnostika pro živou etapu
Využitelné jsou kód a lokální QR, `join-game`, `game_sessions`, `game_players`, stávající živé přenosy s obnovou a `/live/projektor/:sessionId`. Existují také základní zobrazení hlasování a nástěnky. Nový paralelní systém relací, připojování nebo projektoru není potřeba.

Chybí samostatné rychlé spuštění, atomické omezení hlasů, bezpečné opětovné připojení hosta, moderace jednotlivých nápadů a uložení pouze souhrnu ke třídě. Současný `join-game` dovoluje hostovi opakované připojení a sám nemá kontrolu demo páru; Etapa B ji musí doplnit pouze pro nové nástroje, bez změny chování existujících her.

## Etapa B – navržené chování
### Rychlé hlasování
1. Učitel zadá otázku a 2–6 možností nebo zvolí Ano/Ne.
2. Spustí jednu nebodovanou aktivitu ve stávající živé relaci; zobrazí se kód a QR bez jmen.
3. Žák bez účtu odešle jeden hlas; opětovné odeslání stejného hlasu nic nezdvojí. Návrh: hlas po odeslání nelze měnit.
4. Projektor ukazuje sloupce, počty a procenta ze skutečně přijatých hlasů, včetně stavu bez hlasů.
5. Ukončení na serveru zastaví další příjem. Učitel uloží anonymní souhrn ke své třídě nebo hlasování zahodí.

### Nápady a slovní oblak
- Jedna otázka; krátké odpovědi, navržený limit 120 znaků, nejvýše 3 nápady na účastníka.
- Nové nápady nejdřív čekají na schválení učitelem. Na projektoru nejsou nikdy vidět před schválením.
- Učitel schválí nebo skryje jednotlivé odpovědi; skrytí odebere odpověď i z oblaku a jeho četností.
- Výstup je prostý text bez HTML. Žádná AI moderace ani AI generování; AI štítky nejsou potřeba.

## Technický návrh k výslovnému schválení
### Společná infrastruktura, nikoli druhý herní systém
- Rozšířit `create-live-session` o explicitní nebodovaný typ nástroje; otázka/možnosti v `game_sessions.activity_data`. Použít současné stavové přechody a projektor.
- `join-game` zachová současnou herní větev. Jen u nových nástrojů přidat kontrolu hosta, kapacity a demo páru.
- Zachovat `game_players` a serverové expirované join tokeny. Žádné XP, série ani zásah do herního skórování.
- Nové odesílání půjde bezpečnou větví funkce pro odpovědi; ověří relaci, stav, token, typ nástroje a platnou možnost.

### Navrhované tabulky
**`game_tool_responses`**: identifikátor, `session_id`, `player_id`, index otázky, typ (hlas/nápad), volba nebo prostý text, stav moderace, čas vytvoření. Pro hlas unikátní klíč relace + otázka + hráč; pro nápady transakčně hlídaná kvóta. Oddělená odpovědní tabulka chrání stávající `game_responses` a bodování, ale používá stejné relace a účastníky.

**`game_tool_results`**: učitel, volitelná oprávněná třída, otázka a možnosti, anonymní počty hlasů/počet účastníků, čas uložení. Bez player ID, jmen, tokenů, otisků zařízení nebo neschválených nápadů. V první verzi ukládat jen výsledky hlasování; nápady zůstanou dočasné.

**`game_tool_join_limits`**: neveřejné krátkodobé záznamy limitů připojení/odeslání, relace + serverový hash; nikdy jména ani surová IP. Přesný rozsah a úklid projdou bezpečnostní kontrolou před migrací.

Žádná nová tabulka relací. Nové tabulky dostanou explicitní GRANT, RLS a potřebná omezení ve stejné migraci. SQL se připraví a provede až po schválení tohoto plánu.

### Přístup a ochrana soukromí
- Host nesmí přímo číst ani zapisovat odpovědní tabulku; komunikuje pouze přes funkci ověřující join token. Join token není v URL ani protokolech.
- Učitel čte a moderuje jen vlastní relace. Uložený souhrn je jen pro vlastníka; samotné členství ve třídě nezpřístupní další osobní data.
- Projektor dostává pouze agregované hlasování a schválené nápady. Přenos změn využije současné připojení s odstraněním odběru při zavření; moderované texty nebudou veřejně přenášeny syrovým odběrem celé tabulky.
- Souhrn ke třídě uloží server až po ověření současného oprávnění učitele ke třídě. Zahodit lze jen vlastní relaci označenou jako nástroj, nikoli existující hru.
- Dočasné odpovědi a limity se odstraní při zahození nebo po navržených 24 hodinách; uložený anonymní souhrn zůstává, dokud jej učitel nesmaže. Nápady mohou obsahovat údaje napsané žákem: nebudou v analytice, URL ani logu.

### Jeden hlas na zařízení a omezení zneužití
- Atomická unikátnost zajistí jeden hlas na účastnickou identitu; paralelní požadavky nemohou zdvojit hlas.
- Náhodný návratový údaj uložený jen v prohlížeči umožní znovupřipojení ke stejnému hráči; server nepřijme klientem zvolený player ID jako důkaz identity.
- **Bez účtu nelze absolutně zaručit jeden hlas na fyzické zařízení:** smazání úložiště, jiný prohlížeč nebo anonymní okno vytvoří novou identitu. Nepoužívat invazivní fingerprinting; toto omezení nezakrývat.
- Navržené limity: 200 účastníků/relaci, 5 nových připojení/minutu na serverový hash připojení a relaci (nutno ověřit na školní společné síti), 10 požadavků/minutu na token, nejvýše 3 nápady a 120 znaků/nápad. Sdílenou školní síť neblokovat globálním tvrdým limitem IP.
- Učitel může zamknout vstup, odebrat účastníka a ukončit hlasování. Limity, kvóty a ukončení vynucuje server, ne jen telefon.

### Demo
- Etapa A beze změn funguje v prohlížeči a čte jen existující oprávněné seznamy.
- V živých nástrojích demo učitele se smí připojit pouze přihlášený žák stejného demo páru; anonymní vstup i cizí pár budou odmítnuty. Tato nezbytná výjimka se týká pouze dema; běžní žáci zůstávají bez účtu.
- Nové tabulky mají od začátku additive RESTRICTIVE `demo_iso` a příslušné `demo_guard_*` s `is_demo_user()`; staré politiky se neuvolňují ani neodstraňují.
- Každá serverová operace, včetně té se zvýšeným oprávněním, kontroluje vztah k relaci a demo pár výslovně. RLS není náhradou těchto kontrol.
- Úklid nových dočasných záznamů navázat na současný purge/reset jen vlastního páru; sdílené učebnice, ukázkové hry a návštěvníkova ostatní data zůstanou nedotčeny.

## Ověření před dokončením Etapy B
- Jednotkové testy: 2 a 6 možností, atomický jeden hlas, procenta při nule a zaokrouhlování, limity nápadů a moderace.
- Bezpečnostní testy: cizí učitel, neplatný/expirovaný token, ukončená relace, cizí/demo-anonymní návštěvník, dva demo páry, nulová změna běžných her a XP.
- Skutečná cesta se dvěma telefony a projektorem: připojení, hlas, živý souhrn, uzavření, uložení a znovunačtení; nápad před schválením není vidět, skrytý zmizí.
- Pouze vlastní označená testovací data; po ověření úklid jen těchto dat.

**Nyní čeká na schválení pouze Etapa B. Nic z tohoto živého návrhu ani jeho migrací nebylo provedeno a aplikace nebyla zveřejněna.**