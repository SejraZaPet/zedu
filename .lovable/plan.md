# Dialog „AI vytvoří pracovní list z lekce“: šířka a volba „Nezahrnout“

Tento návrh zatím nic nemění. Databáze, edge funkce ani demo ochrany se nemění a nic se nezveřejňuje.

## a) Kde je dialog a proč přetéká

Celý dialog je v `src/pages/WorksheetEditor.tsx`:
- obal: ř. 2973 `DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"`
- sekce: komponenta `AiSectionsBuilder`, ř. 4451–4512
- aktivity: ř. 3073–3105
- pokyn pro AI: ř. 3106–3114

Pravděpodobné příčiny přetečení (vyčteno z kódu, v prohlížeči zatím neověřeno):
1. **Řádek sekce (ř. 4482–4492):** výběr typu otázek má `flex-1`, ale chybí mu `min-w-0`. Výběr nechce zalomit dlouhý název typu, takže řádek roztáhne. Vedle jsou ještě tři tlačítka (↑ ↓ ✕), která se pak nevejdou a odjedou doprava.
2. **Pole Počet/Body/Nadpis (ř. 4493):** mřížka `grid-cols-[5rem_5rem_1fr]`. Sloupec `1fr` se neumí zmenšit pod šířku obsahu, protože mu chybí `minmax(0,1fr)`.
3. **Řádek aktivity (ř. 3082–3093):** název má `truncate`, ale chybí mu `min-w-0 flex-1`. Výběr má pevnou šířku `w-[190px] shrink-0`, takže u dlouhého názvu se řádek roztáhne.
4. **Obal dialogu:** výchozí dialog je mřížka a jeho vnitřní prvky mají minimální šířku podle obsahu. Jeden široký řádek tak roztáhne celý formulář, což se při 125–150 % projeví nejvíc.

Nejmenší oprava (jen třídy vzhledu):
- **Obal:** `w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden`. Svislý posuvník zůstane uvnitř dialogu. `overflow-x-hidden` je jen pojistka, správné rozvržení zajistí body níže. Vnitřní obal `space-y-4` dostane `min-w-0`.
- **Sekce:** horní řádek dostane `flex-wrap`, výběr typu `min-w-0 flex-1 basis-40` a tlačítka zůstanou pohromadě v `flex shrink-0`. Na úzké šířce se tlačítka zalomí na druhý řádek.
- **Pole sekce:** mřížka `grid-cols-[4.5rem_4.5rem_minmax(0,1fr)]`. Pod 400 px (`max-[400px]:grid-cols-2`) se nadpis zalomí na celý další řádek (`col-span-2`).
- **Aktivity:** řádek dostane `flex-wrap`, název `min-w-0 flex-1` a výběr `w-full sm:w-[190px]`. Na úzké šířce jde výběr pod název.
- **Popisky a pokyn:** odstavec u aktivit dostane `break-words`, pole s pokynem `w-full`.

## b) Volba u aktivity a nová hodnota „Nezahrnout“

Jak to funguje dnes:
- Stav `activityModes: Record<id, "qr" | "convert">` (ř. 1314). Ukládá se jen v paměti dialogu, v databázi ani v listu ne.
- Výchozí hodnota je `"qr"` (ř. 1326–1332).
- Při generování (ř. 1716–1721) se aktivity rozdělí na dvě skupiny:
  - **QR kód:** aktivity s `"qr"`, pokud mají vlastní odkaz.
  - **Tištěná úloha:** aktivity s `"convert"` a také aktivity bez vlastního odkazu, tedy vnořené v kartách. Ty se převádějí vždy.
- Obě skupiny jdou do edge funkce `generate-full-worksheet` (ř. 1742–1750) jako `qrLinks` a `activityPlan`.
- Funkce obě pole jen filtruje a prázdné pole bere jako „nic“ (`supabase/functions/generate-full-worksheet/index.ts` ř. 184–200).

Návrh:
- Typ rozšířit na `"qr" | "convert" | "none"`. Výchozí hodnota zůstane `"qr"`, takže dnešní chování se nezmění.
- Rozdělení aktivit přesunout do malé čisté funkce `splitLessonActivities(activities, modes)` v novém souboru `src/lib/worksheet-activity-modes.ts`. Aktivita s `"none"` nebude ani mezi QR kódy, ani mezi úlohami. Platí to i pro aktivity bez odkazu, protože „Nezahrnout“ má přednost před automatickým převodem.
- Do výběru přidat třetí položku „Nezahrnout“. U aktivit bez vlastního odkazu je volba QR kódu nedostupná (dnes se tiše převedou), nabídnou se jen „Převést na úlohu“ a „Nezahrnout“.
- Nad seznam přidat dvě malá tlačítka:
  - **„Nezahrnout žádnou“:** všem aktivitám nastaví „Nezahrnout“.
  - **„Zahrnout všechny“:** vrátí výchozí stav, tedy QR kód tam, kde jde, jinak převod na úlohu.
- Když jsou všechny aktivity „Nezahrnout“, pošlou se dvě prázdná pole. List se pak vytvoří jen ze sekcí a z textu lekce. Edge funkce to už dnes zvládá, proto se nemění a není potřeba ji nasazovat.
- U počtu aktivit se zobrazí krátká informace, kolik aktivit se vynechá.

## c) Migrace

Migrace potřeba není. Volba se v databázi nikde neukládá a mění se jen obrazovka a obsah požadavku. Edge funkce zůstává beze změny.

## d) Rizika a testy

**Rizika:**
- **Pokyny pro AI:** formát pokynů ani výsledku se nemění. Vynechané aktivity se AI prostě nepošlou.
- **Stávající listy a tisk:** nic se jim nemění. Volba platí jen pro nové generování.
- **Demo ochrany:** beze změny. Volání AI pro demo dál hlídá stávající limit.
- **Úzká šířka:** zalomení může v užším okně trochu prodloužit dialog. Svislý posun uvnitř dialogu zůstává.

**Testy** (nový soubor `src/test/worksheet-ai-dialog.test.tsx`):
1. `splitLessonActivities`:
   - aktivita s „none“ není mezi QR kódy ani mezi úlohami;
   - výchozí stav dává stejné rozdělení jako dnes;
   - aktivita bez odkazu s „none“ se nepřevede;
   - když jsou všechny „none“, obě pole jsou prázdná.
2. `AiSectionsBuilder`:
   - kontrola, že rozvržení používá `minmax(0,1fr)` a `min-w-0`;
   - řádek s tlačítky má `flex-wrap`.
3. Kontrola v prohlížeči přes Playwright na šířkách 360, 768 a 1024 px a se zvětšením 150 %: otevřít dialog a ověřit, že u dialogu i u všech jeho prvků platí `scrollWidth <= clientWidth`. Zároveň pořídit snímky obrazovky.
4. Spustit celou sadu testů a kontrolu kódu.

## Dotčené soubory
- `src/pages/WorksheetEditor.tsx` (jen dialog a `AiSectionsBuilder`)
- `src/lib/worksheet-activity-modes.ts` (nový)
- `src/test/worksheet-ai-dialog.test.tsx` (nový)
