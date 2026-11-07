# Vyhledávání všude, kde se vybírá – diagnostika a návrh

Jen diagnostika. Kód, databáze ani e-maily se nemění, dokud nenapíšete „schvaluji“.

## Zjištění
- Aplikace má 107 souborů s rozbalovacím výběrem (`Select`). Žádný z nich hledat neumí.
- Hledání s lupou (`Command`) má jen 7 míst: WorksheetEditor, SubjectPicker, LessonPlacementEditor, LessonAssignments, UnassignedTeachersManager, StaffTaskDialog a samotná `ui/command`.
- Hledání bez ohledu na diakritiku už existuje v `src/lib/lesson-picker-search.ts` (`foldText`, `filterByTitle`). Na zhruba 15 dalších místech je napsané znovu po svém.
- Každý dialog s vlastním hledáním ho řeší jinak: jiný vzhled, bez počtu výsledků, bez tlačítka „vymazat“ a s jiným prázdným stavem.

## 1) Kde se něco vybírá
Tabulka vznikla prohledáním kódu. Počty položek jsou odhad podle toho, co se načítá; prohlížečem ani skutečnými daty jsem je neověřovala.

| Soubor / komponenta | Co se vybírá | Položek | Hledání dnes |
|---|---|---|---|
| lesson-plan/AttachExistingDialog | existující plán / list k hodině | desítky | ne (jen zmínka) |
| lesson-plan/PlanWorksheetsSection | pracovní listy do plánu | desítky | ne |
| subject-class/LessonLibraryPicker | lekce z knihovny | stovky | ano, vlastní |
| TeacherSubjectClass – dialog přiřazení plánu, Materiály „Z mé knihovny“ | plán, termín, materiál | desítky | částečně (knihovna ano, termíny ne) |
| TeacherLessonPlanEditor (15× Select) | třída, předmět, termín, metody, listy | 5–100 | částečně |
| teacher/LessonMethodsPicker | metody výuky | ~30 | ne |
| teacher/LessonCurriculumTopicsPicker | témata RVP | desítky | ano, vlastní |
| admin/block-editors/LessonSourcePickerDialog | zdrojová lekce | stovky | ano, vlastní |
| admin/LinkedLessonsDialog | propojené lekce | stovky | ano, vlastní |
| worksheet/QuestionBankPickerDialog | otázky z banky | stovky | ano, vlastní |
| worksheet/PublishWorksheetDialog (3× Select) | třída/skupina/předmět | 5–30 | ne |
| notebook/InsertWorksheetButton | pracovní list do sešitu | desítky | ne |
| assignments/AssignmentTargetsPicker | třídy a skupiny pro úkol | 5–40 | ne |
| assignments/AssignmentRecipientsPicker | žáci příjemci | 10–35 | ano, vlastní |
| TeacherAssignments (15× Select) | třída, předmět, list, aktivita, učebnice | 5–200 | částečně |
| assignments/AssignmentListFilters | filtry seznamu | do 30 | částečně |
| TeacherSubjectGroups (2× Select) | členové skupiny, třída | 10–35 | ano, vlastní |
| subjects/SubjectPicker | předmět | ~40 | ano (Command) |
| sharing/ShareContentDialog | kolegové ke sdílení | desítky | ano, vlastní |
| MessagesPage | kontakty / nová konverzace | desítky až stovky | ano, vlastní (bez diakritiky) |
| class-wall/ClassWall | „Zeptat se učitele“ (kontakt) | 1–5 | ne (není třeba) |
| activities/ActivityWizardDialog | lekce, typ aktivity | desítky | ano, vlastní |
| TeacherSuggestByMethod (5× Select) | předmět, ročník, metoda | 5–40 | ano, vlastní |
| media/MediaPickerDialog | obrázky a soubory | stovky | ano, vlastní |
| game/GameBackgroundPickerDialog, GameBackgroundSelect | pozadí her | desítky | ano, vlastní |
| game/QuickGameDialog, LiveGameButton | aktivita / lekce pro hru | desítky | ne |
| admin/IconPickerDialog | ikony | stovky | ano, vlastní |
| calendar/ScheduleExceptionDialog, PlanForClassFields, schedule/LessonFormDialog | třída, předmět, hodina | 5–40 | ne |
| teaching/UnitCurriculumPlansCard | tematický plán | do 20 | ne |
| portfolio/AddPortfolioItemDialog, RubricEvaluator | práce, kritéria | do 30 | ne |
| classroom/PeopleTools | žáci ve třídě | 10–35 | ne |
| notifications/NotificationComposer | příjemci (třídy/role) | desítky | ne |
| TeacherWorksheets, TeacherTextbooks, TeacherLessonPlans, TeacherGames, TeacherQuestionBank | filtry seznamů | do 40 | seznam ano, rozbalovací filtry ne |
| school/SchoolResourcesManager, SchoolMeetings | místnosti, kolegové | desítky | ne |
| admin/UsersManager, CRM, StaffTaskDialog | uživatelé, školy | stovky | ano |
| drobné volby (téma, barva, jazyk, velikost písma, žebříček, ročník, ...) | pevné volby | 2–7 | ne (není třeba) |

## 2) Sjednocení
Navrhuji tři sdílené součásti:

- **Hledací pole s lupou** – políčko na hledání pro seznamy a dialogy. Má ikonu lupy, tlačítko „vymazat“ (✕), vymazání klávesou Esc, výšku nejméně 44 px a popisek pro čtečky obrazovky. Pod polem oznámí čtečce „Nalezeno 12“.
- **Rozbalovací výběr s hledáním** – náhrada rozbalovacích nabídek s více než 7 položkami. Je postavený na stávající nabídce s hledáním (`Command` v okně). Ovládá se šipkami, Enter vybírá a Esc zavírá. Na telefonu se otevře přes celou šířku.
- **Seznam s hledáním** – pro seznamy se zaškrtávacími políčky (žáci, lekce, materiály). Umí „Vybrat vše z nalezených“, zachová dříve vybrané položky i mimo hledání a zobrazí počet vybraných.

Pravidla hledání:
- Hledání nerozlišuje velká a malá písmena ani diakritiku: „zlomky“ najde „Zlomky“ a „cestina“ najde „Čeština“.
- Prohledává název i podtitul (třídu, předmět, datum). Víc slov znamená, že musí sedět všechna.
- Prázdný stav ukáže text „Nic nenalezeno“ a tlačítko „Vymazat hledání“.
- Funkce hledání bude jedna a společná, rozšíření dnešní `foldText`. Ostatní vlastní kopie se na ni postupně převedou.

**Pravidlo počtu položek:** hledání se ukáže vždy od 8 položek výš. U 7 a méně se schová. Výjimka: seznamy, které rostou (lekce, listy, žáci, kontakty, materiály), mají hledání vždy, i když jsou zatím krátké.

## 3) Etapy
1. **Nejčastější výběry učitele:** přiřazení plánu a pracovního listu k hodině, Materiály z knihovny, výběr lekce, list do sešitu, rychlá a živá hra. Soubory: AttachExistingDialog, PlanWorksheetsSection, LessonLibraryPicker, TeacherSubjectClass, InsertWorksheetButton, QuickGameDialog, LiveGameButton, TeacherLessonPlanEditor.
2. **Žáci a lidé:** příjemci úkolu, členové skupiny, žáci v nástrojích do hodiny, kontakty ve Zprávách, sdílení s kolegy. Soubory: AssignmentRecipientsPicker, TeacherSubjectGroups, PeopleTools, MessagesPage, ShareContentDialog.
3. **Třídy, skupiny a předměty:** výběr cílů úkolu, rozbalovací nabídky v editoru úkolu a plánu, zveřejnění listu, kalendář a rozvrh. Soubory: AssignmentTargetsPicker, TeacherAssignments, PublishWorksheetDialog, ScheduleExceptionDialog, PlanForClassFields, LessonFormDialog, NotificationComposer.
4. **Sjednocení stávajících hledání:** převést vlastní hledání na společné součásti, aby fungovala stejně. Patří sem MediaPicker, IconPicker, QuestionBank, LessonSourcePicker, LinkedLessons, ActivityWizard, SuggestByMethod, GameBackground a SubjectPicker.
5. **Administrace a škola:** UsersManager, CRM, SchoolResources, SchoolMeetings a filtry seznamů.

**Rizika**
- Nahrazení rozbalovací nabídky může změnit, co se uloží. Proto se zachová stejná hodnota i stejný popis vybrané položky a výběr se jen přebalí.
- Uvnitř celé obrazovky nebo projekce musí nabídka zůstat viditelná, takže použije stávající pravidlo pro zobrazení nad vrstvou.
- U vícenásobného výběru nesmí hledání ztratit skryté vybrané položky.
- Velké seznamy (ikony, média) se načítají po částech. Hledání tam zůstane takové, jaké je dnes; mění se jen vzhled.
- Žádné oprávnění se nemění. Hledá se jen v tom, co si stránka už načetla.

**Testy**
- Společná funkce hledání: diakritika, velikost písmen, víc slov, podtitul.
- Hledací pole: tlačítko vymazat, Esc a počet výsledků pro čtečku obrazovky.
- Rozbalovací výběr: šipky, Enter, prázdný stav, pravidlo „od 8 položek“.
- Seznam s hledáním: zachování skrytých vybraných a „Vybrat vše z nalezených“.
- Po každé etapě proběhnou stávající testy, kontrola typů a sestavení. Pak ověření v prohlížeči na šířce 390 a 1440 px.

## 4) Databáze
Databázi nic z toho nepotřebuje. Hledá se v datech, která stránka už má, takže jde čistě o úpravu aplikace bez nasazení serverových funkcí.

Jediná výhrada se týká seznamů načítaných po částech. Tam hledání pokryje jen načtenou část. Případné hledání přímo v databázi by byla samostatná pozdější etapa a teď se nenavrhuje.

## Na čem se rozhodnout
1. Které etapy schválit (doporučuji začít 1 a 2).
2. Pravidlo: hledání od 8 položek, rostoucí seznamy vždy – souhlas?
3. Mají se nahradit i rozbalovací nabídky s více než 7 položkami, nebo jen dialogy a seznamy?
4. Má hledání u lekcí a listů prohledávat i podtitul (učebnici, předmět, třídu)?
