# Oprava: uložení hry navázané na knihovní lekci

## 1. Diagnóza (potvrzeno)

- Dialog „Uložit hru" nabízí v poli „Lekce" sloučený seznam ze dvou tabulek:
  - vlastní lekce učitele (`teacher_textbook_lessons`),
  - knihovní/katalogové lekce ke stejnému předmětu (`textbook_lessons`).
- Seznam si nepamatuje, odkud která lekce je; při uložení se ID vždy zapíše do `teacher_game_templates.textbook_lesson_id`.
- Tento sloupec má cizí klíč jen na `teacher_textbook_lessons`. Lekce o přípravě těst je knihovní (`textbook_lessons`), proto databáze uložení odmítne.
- Stejný typ chyby jako u duplicitní učebnice v H3.A: jedno ID, dvě možné tabulky.

## 2. Návrh opravy

Vzor, který už v projektu existuje u `lesson_method_links` (dva samostatné sloupce s vlastní vazbou):

1. **Databáze (bez ztráty dat, nic se nemaže):** přidat do `teacher_game_templates` nepovinný sloupec `catalog_lesson_id` s vazbou na `textbook_lessons(id) ON DELETE SET NULL`. Stávající `textbook_lesson_id` zůstane pro vlastní lekce.
2. **Dialog „Uložit hru":** každá lekce v seznamu nese svůj původ (vlastní / knihovní). Při uložení:
   - vlastní lekce -> `textbook_lesson_id`, `catalog_lesson_id = null`,
   - knihovní lekce -> `catalog_lesson_id`, `textbook_lesson_id = null`.
   Při otevření uložené hry se předvybere ta, která je vyplněná.
3. **Spuštění hry:** `sourceLessonId` v nastavení živé relace bere kteroukoli z obou vazeb, takže hra dál ví, ke které lekci patří.
4. Rychlá hra (QuickGameDialog) vazbu na lekci neukládá, zůstává beze změny.

## 3. Další místa se stejným rizikem

Tabulky s vazbou jen na `teacher_textbook_lessons`, kam se může dostat ID knihovní lekce:

- `teacher_presentations.lesson_id` – prezentace z lekce. Ověřím, zda se dá spustit z knihovní lekce; pokud ano, stejná oprava (doplnit `catalog_lesson_id`).
- `lesson_curriculum_coverage.lesson_id` – párování lekce s tématy ŠVP. Ověřím, zda výběr nabízí i knihovní lekce.
- `lesson_placements`, `teacher_lesson_completions` – podle kódu pracují jen s vlastními lekcemi; jen kontrola.
- `lesson_method_links` už má obě vazby, je v pořádku.

U těchto tří bodů nejdřív zkontroluji, odkud se ID bere. Opravím jen místa, kde knihovní lekce opravdu může přijít, stejným způsobem a s vaším souhlasem pro každé z nich, pokud by to měnilo chování.

## Ověření

Uložit hru navázanou na knihovní lekci (test přípravy těst) i na vlastní lekci, znovu otevřít a zkontrolovat předvyplněnou lekci, spustit hru. Testovací hry pak smažu.
