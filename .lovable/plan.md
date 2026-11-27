# Demo: nová lekce se po vytvoření nezobrazí – diagnostika a návrh opravy

## Zjištění (čtení kódu a živé databáze)

1. **Co dělá „Vytvořit lekci“** (`src/pages/TeacherTextbooks.tsx:564-594`). Obě tlačítka, „+“ u tématu (`TextbookGradeGroups.tsx:459` → `TeacherTextbooks.tsx:903`) i „Lekce“ v liště (`:880-881`), otevřou stejný dialog. Ten vloží řádek do **sdílené tabulky `textbook_lessons`** se `status: "draft"` (`:577-583`). Kontroluje se jen `error`, bez `.select()` a bez počtu řádků. Bez chyby se ukáže „Lekce vytvořena“ a seznam se načte znovu (`refreshDetail`). Načtení (`:252-268`) čte témata podle předmětu a lekce z `textbook_lessons` podle tématu. Žádná následná úprava po vložení neprobíhá.
2. **Živá pravidla na `textbook_lessons`:**
   - Vložení: „Teacher can insert“ (`is_admin_or_teacher()`). Pravidlo `demo_guard` pro vkládání neexistuje, **vložení tedy projde**.
   - Čtení: platí dvě omezující pravidla.
     - `demo_iso_global_lessons`: demo uživatel vidí jen řádky s `is_demo_seed = true`. Nový řádek ho má `false`.
     - `hide_draft_lessons` (migrace 0100): koncept vidí jen admin nebo lektor. Nový řádek je koncept.
   - Úprava a mazání: `demo_guard_update/delete` je demo uživateli úplně zakazuje.
   - Triggery: jen `updated_at`. Nic řádek neschovává ani nemaže.
3. **Řádky v databázi skutečně vznikly.** Dnes je tu 5 nových konceptů (`is_demo_seed=false`), všechny v tématu „Téma 1“ předmětu `zkouska_ucebnice`, vytvořené 13:39–13:41 UTC. Včera jich bylo 13. Zda je vytvořil právě demo účet: **neověřeno**, protože tabulka nemá sloupec s autorem.
4. **Přesná příčina:** zápis projde, ale demo učitel nový řádek nesmí číst, a to hned ze dvou důvodů (`demo_iso_global_lessons` a `hide_draft_lessons`). Toast se proto ukáže a lekce se nezobrazí. I kdyby ji viděl, nemohl by ji upravit ani smazat (`demo_guard_update/delete`). Insert blokovaný není a žádný tichý update po něm neběží.
5. **Souvislosti, které jsou důležité pro přednášku:**
   - **Import souboru** (`ImportTextbookFileDialog.tsx:563`) zapisuje do stejné tabulky. Na demu se proto importované lekce také nezobrazí. Úkol 2 by tak selhal stejně.
   - **Běžný učitel:** podle pravidla `hide_draft_lessons` nevidí ani svůj nový koncept. Ovlivňuje to i ostrý provoz, nejen demo. Dopad v aplikaci: neověřeno.
   - **Sdílení mezi účty:** `textbook_lessons` ani `textbook_topics` nemají autora. Témata jsou sdílená podle předmětu a pravidlo na izolaci dema pro témata chybí. Demo účty se stejným předmětem by se mohly navzájem vidět. Noční úklid dema tyto řádky nedokáže přiřadit ke konkrétnímu účtu, takže zůstanou viset. Jak se tvoří předmět u nové učebnice: neověřeno.

## Navržená oprava (ke schválení)

**Doporučení: jen kód, bez změny databáze.** Vlastní učebnice učitele, včetně dema, budou nové lekce a import ukládat do `teacher_textbook_lessons` s `textbook_id` vlastní učebnice. Stejně to dnes funguje u ukázkových demo učebnic (`TeacherTextbooks.tsx:227-238`). Živá pravidla tam už dovolují:
- vložit lekci do vlastní učebnice (`owns_textbook`),
- číst vlastní lekce,
- upravit a smazat vlastní lekce, pokud učebnice není ukázková (`demo_guard_update/delete` mají tuto výjimku).

Díky vlastníkovi lekce funguje i izolace dema a noční úklid. Limity dema na AI zůstávají beze změny (`demo-ai-guard`).

Kroky:
1. `handleCreateLesson` a import zapíšou do `teacher_textbook_lessons` se `select("id")` a při 0 řádcích zobrazí chybu, ne „Lekce vytvořena“.
2. Načtení detailu bude u vlastní učebnice zobrazovat i tyto lekce pod jejich tématem. Lekce se k tématu přiřadí přes `lesson_placements`, nebo, pokud to oprávnění nedovolí, přes jednu skupinu „Lekce“ jako u ukázkových učebnic. Které z toho projde pravidlem `can_manage_lesson_placement` bez třídy: neověřeno, ověřím před úpravou.
3. Úprava a uložení lekce už používá větev `teacher_textbook_lessons`, stačí ji ověřit.
4. Test: rozhodovací funkce „kam zapsat novou lekci“ (vlastní učebnice → `teacher_textbook_lessons`).

**Alternativa přes databázi (nedoporučuji před zítřkem).** Šla by udělat výjimka v `demo_iso_global_lessons` a `hide_draft_lessons`. Protože tabulka nemá autora, viděli by pak všichni demo účastníci koncepty všech ostatních a úklid by nefungoval. Přesné SQL proto nepřikládám jako bezpečné řešení.

**Úklid dnešních testovacích řádků** (5 lekcí, téma „Téma 1“, předmět `zkouska_ucebnice`): navrhnu SQL zvlášť. Spustím ho jen po Vašem „ano“, protože autora nelze ověřit.

## Ověření
- Playwright jako demo učitel: nová učebnice → téma → „+“ i „Lekce“ → lekce se objeví → upravit → Uložit → po obnovení stránky je tam. Totéž pro import malého DOCX.
- Druhý demo účet lekci prvního nevidí.
- Testovací data označím `[TEST]` a uklidím jen ta svoje.

## Rizika
- Zneužití dema: platí stávající limity tvorby a AI, úklid po 14 dnech maže podle vlastníka.
- Změna se týká i běžných učitelů, protože nové lekce ve vlastních učebnicích půjdou do jejich vlastní tabulky. Stávající lekce v `textbook_lessons` zůstanou beze změny.
