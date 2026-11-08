# Pracovní list u portfoliového úkolu

## A. Proč žák list nevidí ani po vypnutí portfolia

Ověřeno (čtení kódu + SELECT, bez vypisování odpovědí):
- Úkol teď: `is_portfolio_task = false`, `worksheet_id` nastaven, published, bez `kind` (= úkol), bez příjemců, změna 22:47:29 UTC.
- List: `spec.version = "v1"`, published.
- „Žák Testovací“ je účet z `preview_students` (Prohlížíš jako) a je členem skupiny H4E + P2 → politika „Students can read worksheets via assignment“ ho pustí; `demo_iso` se ho netýká.
- Pokus `in_progress` z 21:51 zobrazení listu neblokuje: list se načítá před pokusem a pokus jen předvyplní odpovědi.
- Povinné aktivity lekce (0/3) blokují jen odevzdání, ne zobrazení.
- `sw.js` nic neukládá do mezipaměti (data ani stránky).

Příčina: **pravděpodobná – zastaralé zobrazení**. Přehrávač načte úkol jen jednou při otevření stránky (efekt závisí jen na `assignmentId`) a při návratu do okna se znovu nenačítá. Pokud byla stránka žáka otevřená před 22:47 (nebo se jen přepnulo „Prohlížíš jako“ bez obnovení), drží starý stav `is_portfolio_task = true`. Podle uložených dat by čerstvě načtená stránka list ukázat měla. Jistě to nepotvrdím bez obnovení stránky v účtu žáka.

Krok 1 (bez kódu): obnovit stránku žáka (F5) nebo úkol otevřít znovu. Když list stále chybí, příčina je jinde a před dalšími změnami ji ověřím přímo v prohlížeči jako náhledový žák.

Krok 2 (malá oprava, frontend): přehrávač znovu načte úkol při návratu do okna (`visibilitychange`), jen když žák nemá neuložené změny. Odpovědi zůstanou, stávající automatické ukládání se nemění.

## B. Funkce: portfoliový úkol + pracovní list

Chování pro žáka:
- U `is_portfolio_task && worksheetSpec` se ukáže list (stejný jako u běžného úkolu: autosave, pokusy, tisk) a pod ním volitelné přílohy z portfolia.
- Tlačítko „Odevzdat“ odevzdá pokus listu stávající cestou (hodnocení, povinné aktivity i pokusy beze změny). Potom se vytvoří položka portfolia.
- Portfoliové úkoly bez listu i běžné úkoly s listem se nemění.

Co se uloží do portfolia (návrh):
- Položka portfolia s názvem úkolu, odkazem na úkol a pokus (`assignment_id`, `attempt_id` v existujících polích/metadatech) a PDF žákovy verze listu s jeho odpověďmi. PDF vznikne stávajícím tiskem žákovské verze a uloží se do soukromého úložiště portfolia stejně jako dnes přílohy.
- Žádné odpovědi v lozích ani v chatu. Ukládají se jen do pokusu a do PDF žáka.
- Při dalším pokusu se položka aktualizuje na nejlepší / poslední odevzdaný pokus (rozhodne uživatelka; výchozí návrh: poslední odevzdaný).

Učitelská kontrola: hodnotí se list jako dnes (pokus). V detailu se navíc ukáže odkaz „V portfoliu žáka“.

Databáze: nejdřív ověřím (jen čtení), jestli `submit_portfolio_assignment` a RLS `student_portfolio_items/files` dovolí vytvořit položku s PDF bez souborové přílohy a navázat ji na pokus. Když ano, nebude potřeba žádná změna. Když ne, ukážu jen SQL k odsouhlasení a s ním počkám na „schvaluji“.

## Etapy
1. Krok A2 (obnovení při návratu) + v přehrávači zobrazit list i u portfoliového úkolu. Odevzdání zatím jen jako list, portfolio připíše učitelka ručně. Zrušit blokaci uložení „portfolio + list“ z minulé opravy a nahradit ji informací.
2. Automatické vložení PDF + odkazu do portfolia po odevzdání (po ověření práv, případně SQL ke schválení).
3. Odkaz v učitelské kontrole, chování při dalších pokusech.

## Testy
- Výběr větve: portfolio+list → list. Portfolio bez listu → přílohy. List bez portfolia → beze změny. Materiál → beze změny.
- Opětovné načtení při návratu nepřepíše neuložené odpovědi.
- Odevzdání portfolia+listu nejdřív uloží pokus. Když se portfolio nepovede, pokus zůstane odevzdaný a ukáže se srozumitelná hláška.
- Testovací data označená `[TEST]` (uklidím jen svá), mobil 390 px, typy, build.

## Rizika
- Staré úkoly, které mají zapnuté obojí, začnou žákům ukazovat list (to je žádoucí). Jejich už odevzdané portfoliové položky zůstanou.
- Rozpracovaný pokus zůstane zachován.
- Vytvoření PDF na slabém telefonu může být pomalé, proto vzniká až po úspěšném odevzdání.
