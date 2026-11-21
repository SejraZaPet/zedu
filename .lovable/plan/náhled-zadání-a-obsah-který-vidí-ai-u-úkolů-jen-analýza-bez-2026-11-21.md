# Náhled zadání a obsah, který vidí AI u úkolů (jen analýza, bez nasazení a SQL)

## 1) Náhled zadání

**Současný stav**
- Učitel: `src/pages/TeacherAssignments.tsx` (`/ucitel/ulohy`). Tlačítko „Detail“ otevírá `src/components/admin/AssignmentDetailDialog.tsx`. Dialog obsahuje popis (`AssignmentDescription`), materiály (`AssignmentMaterialsList`) a propojenou lekci (`resolveLinkedLesson`), ale ukazuje je v učitelském rozložení spolu s výsledky žáků. Pohled žáka v něm chybí.
- Žák: `src/pages/StudentAssignments.tsx` a `StudentSubjectClass.tsx`. Tlačítko „Otevřít“ vede na `/student/ulohy/:id`, tedy do `StudentAssignmentPlayer.tsx`. **Přehrávač při otevření zapisuje pokus** (`assignment_attempts.insert`, řádek ~346) a spouští automatické ukládání. Bez úprav ho proto pro náhled použít nejde.
- Režim „Prohlížíš jako žák“ (`ViewAsBanner`, `preview-students.ts`) existuje, ale přepíná celé přihlášení. Na rychlý náhled je to moc kliků (4 a víc).
- Náhled pracovního listu existuje jen v editoru listů, v seznamu úkolů ne.

**Nejmenší řešení**
- Nová komponenta `AssignmentStudentPreview` (sheet nebo dialog) složená z existujících částí: název, termín, `AssignmentDescription`, `AssignmentMaterialsList` a odkaz na lekci nebo pracovní list. Pracovní list se otevře ve stávajícím režimu „pouze pro čtení“ v novém panelu.
- Data načte jen čtením (`assignments` a `parseMaterials`). Nic nezapisuje a nevytváří pokus.
- Tlačítko „Žákovský pohled“ dám nahoru do detailu, protože na mobilu je tam víc místa. V seznamu bude jen ikona oka s aria-label „Náhled zadání“.
- Počet kliků: ze seznamu 1, z detailu 1.
- Žák nic nového nepotřebuje, „Otevřít“ už zadání ukazuje.
- Dodatečně je možné u žáka přidat „Náhled“ u úkolů, které se teprve chystají nebo které už nejde odevzdat. Pokus se ani tehdy nevytvoří.
- Mobil 390 px: sheet přes celou obrazovku s rolováním a zavřením klávesou Esc.
- Odhad: S, asi 0,5–1 den, včetně testu, že se nic nezapisuje.
- Alternativu (`StudentAssignmentPlayer` s parametrem `preview`, který vypne insert a ukládání) nedoporučuji. Riziko je větší, protože přehrávač má zápisy na víc místech (řádky 293–480 a 967).

## 2) Jaký obsah dnes vidí AI

**(a) AI hodnocení učitele** (`src/lib/grading-feedback.ts`, `supabase/functions/suggest-grading-feedback/`)
- Ano: název a popis zadání (pole `question`, max 4 000 znaků).
- Ano: kritéria, ale jen z `settings.criteria`, `gradingCriteria` nebo `rubric` (max 4 000 znaků).
- Ano: odpověď žáka a jeho poznámka (max 12 000 znaků), skóre a maximum bodů.
- Ano: přílohy **žáka** (buckety `student-portfolio`, `assignment-uploads`, `student-attachments`), nejvýše 5 souborů, 8 MB na soubor a 15 MB celkem. Z textových dokumentů se čte nejvýše 12 000 znaků, obrázky jdou jako data URL. Ostatní soubory se označí jako „nečitelné“.
- Ne: materiály zadání (bucket `assignment-materials`, `parseMaterials`).
- Ne: propojená lekce nebo kapitola (`lesson_id`).
- Ne: hodnoticí rubriky z tabulek `grading_rubrics` a `rubric_criteria`.
- U Tyny (Administrativa, lekce 6) tedy AI vidí jen zadání, odpověď a přílohy žáka, ne kapitolu ani materiály.
- Doplnění bez DB:
  - klient pošle `lessonText` (text lekce přes `resolveLinkedLesson` a `blocksToText`, max 6 000 znaků);
  - klient pošle `materials`, tedy cesty v `assignment-materials`, které funkce přečte **tokenem učitele** se stejnými limity jako u příloh;
  - funkce přidá bucket `assignment-materials` na seznam povolených a pravidlo, že materiály jsou podklad, ne práce žáka;
  - pokud je k úkolu navázaná rubrika, pošlou se i její kritéria.
- Odhad: M, asi 1 den.

**(b) Bezlai v úkolu** (`StudentAssignmentPlayer.tsx` ř. 1220, `ask-zedai-tutor`)
- Ano: jen `question`, tedy název a text popisu.
- Ne: materiály zadání, propojená lekce, pracovní list, kritéria. Funkce v kontextovém režimu nic nedohledává.
- Doplnění bez DB:
  - klient pošle `lessonId` a `lessonSource`;
  - funkce text lekce načte **tokenem žáka** (RLS) a předá ho jako úryvky s názvem zdroje (5×800 znaků, stejné jako RAG ve volném režimu);
  - textové materiály zadání (PDF nebo TXT) se zpracují stejně, nejvýše 2 soubory.
- Zelený nebo žlutý štítek zdroje začne fungovat i v úkolu.
- Sokratovské chování (žádné hotové odpovědi) zůstane.
- Odhad: M, asi 1 den.

**(c) AI při tvorbě úkolu nebo listu z lekce** (`lesson-ai-source.ts`, `CreateFromLessonDialog`, `generate-lesson-worksheet`, `generate-activity-content`, `generate-lesson-quiz`)
- Ano: text vybraných částí lekce. Kartičky a doplňovačky mají max 6 000 znaků, kvíz a přiřazování 14 000 znaků. Zdroj se kontroluje přes `teacher-source-lessons`.
- Ne: materiály a přílohy úkolu a soubory. Generování probíhá před vznikem úkolu, takže materiály zatím neexistují.
- Doplnění (volitelné): v dialogu „Přidat podklad“ znovu použít `PracticeSourceEditor` (text, PDF, TXT, foto) a spojit ho s textem lekce v rámci stejného limitu. Odhad: S–M.

## Kroky k odsouhlasení
1. Náhled zadání pro učitele (S).
2. AI hodnocení vidí lekci, materiály zadání a rubriku (M).
3. Bezlai v úkolu vidí lekci a materiály zadání se štítkem zdroje (M).
4. Volitelně: vlastní podklad v CreateFromLessonDialog (S–M).

Nic z toho nevyžaduje SQL ani RLS. Čte se jen přes JWT učitele nebo žáka. Pokud by čtení `assignment-materials` tokenem žáka narazilo na storage politiku, nejdřív to ověřím dotazem a jen popíšu.
