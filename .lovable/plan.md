# Katalog aktivit: „Otevřená odpověď“ → Zeď a aktivity typu Mentimetr (diagnostika a plán)

## Příčina (jistá)
Karta je na stránce **Aktivity** (`ActivitiesPage.tsx`, katalog ř. 78, tlačítko ř. 365). „Brzy“ se zobrazí, když `isSupported(id)` vrátí false. V `activity-wizard.ts` (`WIZARD_TYPES`) má `open` nastaveno `blockType: null`. Katalog tak nemá kam vést, přestože funkční Zeď existuje. Karta s ní nikdy nebyla propojená. Jde o zástupný záznam, ne o rozbitou Zeď. Totéž platí pro „Interaktivní tabulku“ (`table`).

Katalog na stránce Aktivity obsahuje jen 10 procvičovacích typů. Zeď, Anketa ani Oblak slov v něm vůbec nejsou.

## Co dnes funguje (ověřeno čtením kódu)
| Typ | Lekce (editor bloku) | Prezentace / živá hra | Žák | Projektor |
|---|---|---|---|---|
| Zeď (`wall`) | ano (`ActivityBlock`, `LessonBlockRenderer`) | ano (AddSlideSheet, PresentationEditor) | ano (`StudentGamePlay`) | ano |
| Anketa (`poll`) | editor ano, zobrazení žákovi v lekci neověřeno | ano | ano | ano (`LiveTeacherScreen`) |
| Oblak slov (`wordcloud`) | ne | ano (AddSlideSheet „Oblak slov“) | ano | ano, se zveřejněním |
| Kvíz ABCD | ano | ano | ano | ano |
| Škála / hodnocení, žebříček, otázky s hlasováním | ne | ne | ne | ne (server je zná jen jako názvy v `session-participants.ts`) |

Odeslání odpovědí řeší serverová funkce `submit-activity-response` (u wall, wordcloud a open bez bodování).

## Návrh po etapách

**Etapa 1 – oprava katalogu (jen frontend, doporučuji hned):**
- Karta „Otevřená odpověď“ dostane název „Zeď odpovědí (otevřená odpověď)“ a tlačítko „Použít aktivitu“. Průvodce vloží blok `wall` do lekce, nebo slide `wall` do prezentace či živé hry. Využijí se k tomu stávající presety, nic nového.
- Do katalogu se přidá nová skupina **„Živě se třídou“** s kartami Zeď, Anketa a Oblak slov. Dostanou jednotné české názvy a ikony z `activity-slide-presets.ts`. Oblak slov a Anketa povedou do prezentace nebo živé hry. V lekci jen tam, kde to dnes funguje.
- „Interaktivní tabulka“ zůstane „Brzy“ s vysvětlujícím textem.
- Úprava se týká jen `activity-wizard.ts` (mapování) a `ActivitiesPage.tsx`. Databáze ani server se nemění.

**Etapa 2 – sjednocení:** Oblak slov se doplní do editoru lekce a Anketa do žákovského zobrazení lekce (jen když to bude dávat smysl bez promítání). Napříč aplikací se sjednotí názvy: „Oblak slov“ a „Slovní mrak“ na jeden název, stejně tak „Zeď“ a „Zeď odpovědí“.

**Etapa 3 – nové typy jako v Mentimetru:** Škála (1–5 / 1–10, průměr a rozložení), Žebříček (žáci řadí položky, výsledkem je pořadí) a Otázky s hlasováním (žáci posílají otázky a hlasují pro ně). Všechny tři vyžadují úpravu serverové funkce `submit-activity-response` a zobrazení na projektoru. Projdou zvlášť diagnostikou a schválením. Zda bude potřeba změna DB, je zatím nezjištěné. Pokud ano, ukážu SQL a počkám na „schvaluji“.

**Mimo tento plán:** otevřená odpověď s hodnocením učitelkou („Ke kontrole“). Ta funguje už dnes v pracovním listu (`open_answer`).

## Testy
- `isSupported("open")` vrací true a mapuje se na `wall`.
- Nové karty skupiny „Živě se třídou“ vedou na správný preset.
- Tabulka zůstává „Brzy“.
- Ostatních 8 typů je beze změny.
- Mobil 390 px, ovládací prvky aspoň 44 px, bez vodorovného posunu.

## Rizika
- Zeď v lekci, která se nepromítá, ukazuje odpovědi spolužáků. Výchozí nastavení proto bude anonymní, jako v presetu.
- Odpovědi žáků se nikde nevypisují mimo oprávněné zobrazení.
- Staré aktivity, živé hry ani bodování se nemění.

## Otevřené otázky
1. Má karta „Otevřená odpověď“ vést na Zeď, nebo na otevřenou odpověď v pracovním listu s hodnocením?
2. Který název chcete: „Oblak slov“, nebo „Slovní mrak“?
3. Které typy z etapy 3 chcete jako první?
