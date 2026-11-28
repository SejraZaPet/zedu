# Plán: živé prezentace v záložce Prezentace a jasně označené demo

Jen návrh. Nic se nenasazuje, AGENTS.md, databáze, RLS ani SQL se nemění.

## A) „Běží živě“ v záložce Prezentace

### Zjištěný stav
- Spuštění z Prezentací (`TeacherPresentations.tsx`, `launchLive`) založí řádek `game_sessions` jen s `teacher_id`, `title`, `game_code`, `activity_data` (kopie slidů), `settings`, `status: "lobby"`.
- `game_sessions` nemá sloupec s odkazem na prezentaci a odkaz se neukládá ani do `settings`. Prezentace tedy dnes neví, že běží; najít ji jde jen v Živých hrách (`TeacherGames.tsx`).

### Návrh (pouze frontend, bez změny schématu)
1. Při spuštění zapsat do existujícího JSON `settings` klíč `presentationId` (a `source: "presentation"`). Učitel už do `settings` zapisuje, RLS se nemění.
2. Na stránce Prezentace jeden dotaz na vlastní sezení: `game_sessions` s `teacher_id = já`, `status` jiný než ukončený, vytvořené za posledních 12 h (filtr proti „zapomenutým“ hrám). Výběr jen `id, game_code, status, title, settings, created_at`.
3. Sekce „Právě běží“ nahoře (jen když něco běží): název, kód hry, stav (Čekárna / Běží), tlačítka „Pokračovat v ovládání“ (`/live/ucitel/:id`), „Projektor“ a „Ukončit“ (stejná akce jako v Živých hrách).
4. Na kartě prezentace štítek „Běží živě · ABC123“ a tlačítko „Pokračovat“ místo/vedle „Spustit“. Před novým spuštěním téže prezentace dotaz „Prezentace už běží – pokračovat, nebo spustit znovu?“ (zabrání dvojím hrám).
5. Starší sezení bez `presentationId`: zobrazit jen v sekci „Právě běží“ (bez párování ke kartě; párování podle názvu je nespolehlivé).
6. Obnovení: při návratu na stránku a při fokusu okna; realtime netřeba.
7. Test: čistá funkce `matchLiveSessions(presentations, sessions)` (párování, filtr stavů a stáří).


### Návrat do běžícího sezení bez nové hry
- Karta prezentace najde sezení přes `settings.presentationId` (vlastní, neukončené, ≤12 h). Tlačítko „Otevřít živě“ jen naviguje na existující `/live/ucitel/:id` (resp. `/live/projektor/:id`) – žádný INSERT, stav hry (slide, hráči, odpovědi) zůstává, protože se čte ze session.
- Tlačítko „Spustit“ při běžícím sezení nejdřív nabídne „Pokračovat v běžící“ (výchozí) / „Spustit novou“.
- Více běžících sezení jedné prezentace: štítek „Běží živě (2)“, tlačítko otevře výběr seřazený od nejnovějšího (kód, čas spuštění, stav, počet hráčů) s akcemi Otevřít / Ukončit. Jedno sezení = rovnou otevře.

Volitelně později (SQL, jen popis): sloupec `game_sessions.presentation_id uuid` + index; dnes není potřeba.

## B) Demo jako zjevná ukázka

### Zjištěný stav
- Oranžový `DemoBanner` už existuje (odpočet, limity AI, „Uložit moji práci“, kód páru, lze sbalit).
- Serverové zámky (RESTRICTIVE `demo_guard_*`) dnes brání hlavně úpravám/mazání sdíleného obsahu: assignments, classes, lessons, textbook_lessons, teacher_textbooks(+lessons), teacher_presentations, worksheets, question_bank_items, subject_groups (UPDATE/DELETE); teacher_game_templates, banners, user_roles (vč. INSERT); preview_students a výjimky rozvrhu úplně; school_join_requests INSERT.
- Limity: AI přes `_shared/demo-ai-guard.ts` + `demo_config` / `demo_event_config`; nahrávání přes `demo_storage_upload_ok` (přípony, počet, velikost); vznik dema na IP/den.
- Převod: plán `.lovable/plan/demo-prevod-na-ostry-ucet-2026-11-19.md` (kontakt, export, odpočet hotové; samotný převod na ostrý účet je jen návrh).

### Návrh
Frontend:
1. Pruh: text „Ukázkový režim – pro vyzkoušení. Data se po 14 dnech nečinnosti smažou. Ostrý provoz: bezli.cz → Registrace.“ + tlačítko „Založit ostrý účet“. Sbalená verze stále ukazuje štítek „Ukázka“.
2. Štítek „Ukázka“ v hlavičce vedle loga a v okně odeslání e-mailu/zprávy; vodoznak „Ukázka“ v exportech PDF/PPTX z dema (volitelně).
3. Skrýt/zamknout v UI s vysvětlením „V ukázce nedostupné“: hromadné e-maily, oznámení všem, import uživatelů, správa školy, licence, BezliMarket prodej, propojení s rodiči, push notifikace.
4. „Založit ostrý účet“: dnes vede na registraci + nabídku „Uložit moji práci“ (export). Automatický převod obsahu až po schválení etapy převodu.

Vyžadovalo by SQL / server (jen popis):
- Skutečná blokace e-mailů a zpráv z dema (UI skrytí lze obejít): kontrola `is_demo_user()` v `send-email` a RESTRICTIVE policy na `messages`/`notification_broadcasts`/`parent_messages` INSERT.
- Přísnější nahrávání: úprava `demo_storage_upload_ok`.
- Převod účtu: funkce přenášející obsah páru na nový účet (podle návrhu z 19. 11.).


### Upřesnění: demo = jen vybrané funkce (rozhodnutí majitelky)
Dostupné v demu: učebnice ke čtení (ukázkové), vlastní prezentace a editor, živá prezentace/kvíz s demo žákem, pracovní listy, aktivity, úkoly pro demo třídu, Bezlai v omezeném počtu dotazů, ukázkové hry.
Skryté/zamčené s kartou „Dostupné v ostrém účtu“ (krátký popis + „Založit ostrý účet“): e-maily a hromadná oznámení, zprávy rodičům, správa školy a uživatelů, import, licence a BezliMarket, rozvrh školy a výjimky, Akademie/certifikáty, push notifikace, nahrávání větších souborů a audio/video, exporty bez vodoznaku, sdílení mimo demo.

Technicky:
- Frontend: jeden zdroj pravdy `useDemoPair()` → nový `demo-features.ts` (seznam povolených funkcí, čistá funkce `isDemoFeatureAllowed(key)`, test). Komponenta `DemoLockedFeature` místo prázdné stránky; menu a dlaždice skryté položky zobrazí se zámkem. Trasy chráněné stejným seznamem.
- Server (edge funkce): sdílený `_shared/demo-feature-guard.ts` s týmž seznamem; demo uživatel (podle JWT a demo_pairs, jako `demo-ai-guard`) dostane 403 `DEMO_FEATURE_LOCKED` v send-email, broadcastech, importu uživatelů, create-school-*, exportu apod. Bez SQL.
- Vyžadovalo by SQL (jen popis): RESTRICTIVE `demo_guard_*` INSERT na messages, parent_messages, notification_broadcasts, school_* a další tabulky, kam klient zapisuje přímo; případně zpřísnění `demo_storage_upload_ok`. Bez toho jde zamčení obejít přímým voláním API.

AI limity:
- Demo: vlastní nižší trvalé limity v `demo_config` (dnes 25/účet, 1500/den globálně) – navrhnout snížení až po schválení.
- Dočasné zvýšení pro akci (`demo_event_config`, „dalkove-ucitele“ do 29. 11.) je oddělené a po vypršení samo končí; nemíchat s trvalými limity.
- Ostrý účet po registraci a schválení: demo-guard se ho netýká, řídí se běžnými limity účtu/školy; při převodu dema se počitadla demo nepřenáší.

## Kroky
1. A1–A2: zápis `presentationId` + dotaz a sekce „Právě běží“ (frontend, test).
2. A3–A4: štítek na kartě a ochrana před dvojím spuštěním.
3. B1–B2: texty pruhu a štítek „Ukázka“.
4. B3: UI zamčení funkcí v demu.
5. Serverové zámky a převod – samostatné schválení SQL.

## Rizika
- Staré hry bez `presentationId` se ke kartě nespárují.
- Neukončené hry by svítily jako „běží“ – proto filtr stáří a tlačítko Ukončit.
- Skrytí funkcí jen v UI není bezpečnostní zámek.
- Delší pruh na mobilu 360 px zabere místo – nutná kontrola rozložení.

## Otevřené otázky
1. Za jak dlouho považovat neukončenou hru za neaktivní (návrh 12 h)?
2. Má „Ukončit“ být přímo v Prezentacích?
3. Potvrdit seznam dostupných/zamčených funkcí dema a počet dotazů Bezlai v demu.
4. Přesný text pruhu a cíl tlačítka (registrace na bezli.cz, nebo převod s obsahem)?
5. Mají se ukázkové exporty označit vodoznakem?
