# Vyhodnocení žáka – analýza a návrh (nic se neimplementuje)

## A) Co dnes existuje
- **Silné/slabé stránky (plán 2026-10-11): implementováno.** `src/lib/best-results.ts`, `src/lib/strengths-weaknesses.ts`, `src/components/admin/AssignmentDifficultyStats.tsx`. Funguje to po otázkách v úkolu (první vs. nejlepší pokus, žáci pod 50 %) a v souhrnu top 5 / bottom 5 na `src/pages/TeacherResults.tsx`. Nefunguje to po tématech ani po lekcích.
- **Hodnocení úkolů:** `assignment_attempts` (score, max_score, teacher_feedback_text/emoji/at/by). AI návrh textu a bodů (`suggest-grading-feedback`, `TeacherReviewQueue`, `AssignmentDetailDialog`, `WorksheetAttemptGrading`) jen předvyplní pole, nic sám neuloží.
- **Mastery lekcí:** `student_lesson_mastery` (mastery_percent, sessions_count, mastered_at), plní ji procvičování v `StudentPractice.tsx` a `student-learning-overview.ts`.
- **Procvičování:** `student_practice_sessions` (metoda, lekce, score, ai_generated). Výsledky aktivit v lekcích ukládá `student_activity_results`.
- **Rubriky:** `rubric_evaluations` jsou vázané jen na portfolio, ne na úkoly.
- **Přehled známek 1–5, A, N:** dokument `areas/hodnoceni-prehled-spec` v projektu nenacházím a v databázi není sloupec pro známku. Tento přehled tedy neexistuje.
- **Exporty:** CSV přehled a detail na `TeacherResults.tsx`.
- **Kdo co vidí:**
  - Učitel: Výsledky, detail úkolu a fronta Ke kontrole pro své třídy.
  - Žák: své body, zpětnou vazbu a pokrok v Učím se.
  - Rodič (`ParentDashboard.tsx`): splněné lekce, výsledky aktivit a pokusy svého dítěte, bez slovního závěru.

## B) Data a jejich spolehlivost
- **Spolehlivé:** body pokusů (u ručních položek až po ohodnocení), výsledky aktivit, procvičování, mastery.
- **Slabší:** vazba úkol → téma. Přes `assignments.lesson_id` a `lesson_source` ji má jen část úkolů, ostatní lze zařadit jen pod předmět.
- **Chybí:**
  - uložený slovní závěr a jeho verze,
  - učitelova poznámka k žákovi a předmětu,
  - záznam opakování slabé stránky (co, kdy, s jakým výsledkem),
  - známky.

## C) Návrh po etapách
**1) Vyhodnocení z dat** (žák × předmět, třída): pouze výpočet v nové `src/lib/evaluation.ts`, který znovu použije best-results a strengths-weaknesses a seskupí data podle lekce/tématu. Panel na `TeacherResults` a v detailu žáka, jen pro učitele. Upozornění při málo datech (méně než 3 položky).
- Bez SQL. Odhad M, 1,5–2 dny.

**Viditelnost:** vše je interní a vidí to jen učitel. Žák ani rodič nic nevidí, nic se jim nezveřejňuje a u žáka není žádný štítek AI.

**2) Závěr s historií verzí a „Aktualizovat závěr“** (SQL ke schválení)
- Tabulka `teacher_student_evaluations` jen pro přidávání nových řádků:
  - sloupce: id, student_id, subject_id, scope_type (class/group), scope_id, author_id, kind (conclusion/note), text, source (teacher/ai_draft/ai_edited), data_snapshot jsonb, based_on_until, supersedes_id, created_at;
  - oprava = nový řádek, bez UPDATE/DELETE (mazání jen adminem na žádost GDPR).
- Přístup se vyhodnocuje jedinou SECURITY DEFINER funkcí `can_access_student_evaluation(scope_type, scope_id, subject_id)`.
  - Nyní vrací true jen učiteli, který danému žákovi v daném předmětu a třídě/skupině zadává úkoly: autor `assignments` nebo `class_teachers`/`subject_groups` pro daný předmět.
  - Politiky SELECT/INSERT volají jen tuto funkci, INSERT navíc `author_id = auth.uid()`.
- **Pozdější rozšíření bez přestavby:** třídní učitel a vedení se doplní jen do těla funkce (např. `role` z `class_teachers` nebo `school_admin` stejné školy jen pro čtení). Tabulka, politiky ani klient se nemění. Případně přibude sloupec `audience` (výchozí `subject_teacher`), který umožní skrýt poznámku před vedením.
- Grants jen pro authenticated a service_role. Přidají se RESTRICTIVE `demo_guard_*` a `demo_iso`.
- Žák, rodič ani anon nemají žádnou politiku.
- Odhad M–L, 2–3 dny.

**3) AI „co opakovat“:** 3–5 slabých lekcí nebo témat s odkazem na procvičování.
- Nová data po `based_on_until` vyvolají výzvu „Data se změnila – aktualizovat závěr“.
- Bez dalšího SQL. Odhad M, 1,5 dne.

**4) Poznámky učitele** (`kind='note'`): AI je při dalším závěru dostane jako ověřený údaj od učitele. Odhad S.

**Ochrana osobních údajů:**
- AI dostane pseudonym „Žák A“ a čísla po tématech, dále předchozí závěr a poznámky.
- AI nedostane jméno, e-mail, třídu, doslovné odpovědi, přílohy ani data jiných žáků.
- Učitel uvidí upozornění, ať do poznámek nepíše citlivé údaje.
- Volání jde přes token učitele, v demu platí `demo-ai-guard`.
- U učitele zůstává štítek AI.

## D) První kroky
1. Etapa 1 bez SQL.
2. Etapa 3 jako dočasný koncept.
3. Po schválení SQL etapy 2 a 4.
