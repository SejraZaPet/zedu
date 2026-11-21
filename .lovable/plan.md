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

**2) Slovní závěr s verzemi a tlačítkem „Aktualizovat závěr“** (vyžaduje SQL ke schválení):
- Nová tabulka `student_evaluations`: id, student_id, teacher_id, subject_id, group_id/class_id, text, source (teacher/ai_draft/ai_edited), data_snapshot (jsonb s čísly, z nichž závěr vznikl), based_on_until, visibility (draft/published), published_at, created_at.
- Každá změna přidá nový řádek, starý se nepřepíše. Tím vznikne historie verzí.
- RLS: zapisuje a čte autor a učitelé třídy nebo skupiny. Žák a rodič čtou jen řádky `published`, a to přes SECURITY DEFINER RPC. Přidají se RESTRICTIVE `demo_guard_*` a `demo_iso`.
- AI připraví pouze koncept. Žákovi se závěr zobrazí až po kliknutí učitele na „Zveřejnit“.
- Odhad M–L, 2–3 dny.

**3) AI návrh „co opakovat“:** z dat etapy 1 navrhne 3–5 lekcí nebo témat s odkazem do procvičování.
- Opakování se pozná automaticky z nových `student_practice_sessions`, `student_activity_results` a pokusů po datu závěru (porovnání s `based_on_until`). Pak se zobrazí výzva „Data se změnila – aktualizovat závěr“.
- Bez SQL. Odhad M, 1,5 dne.

**4) Učitelova doplňující informace:** poznámka k žákovi a předmětu (např. „ústně zopakoval zlomky – zvládá“).
- Vstupuje do dalšího AI návrhu jako ověřený údaj od učitele a má přednost před starými daty.
- Ukládala by se do tabulky `student_evaluation_notes` (učitelská, žák ji nevidí), nebo jako `source='teacher_note'` v tabulce z etapy 2. **Doporučuji druhou variantu: jedna tabulka místo dvou.**
- SQL je potřeba jen s etapou 2. Odhad S, 0,5–1 den.

**Ochrana osobních údajů (všechny etapy):**
- AI dostane jen pseudonym a čísla po tématech, bez jména a bez doslovných odpovědí žáka.
- Volání AI přes token učitele, v demu podle `demo-ai-guard`.
- Rodič a žák vidí jen zveřejněnou verzi, nikdy koncept ani učitelské poznámky.

## Otázky pro Tynu
1. Má žák nebo rodič u zveřejněného závěru vidět štítek „AI“? Pravidlo EU AI Act vyžaduje označení u učitele. U žáka rozhodne Tyna, bez jejího rozhodnutí štítek nepřidám.
2. Mají závěr vidět i rodiče, nebo jen žák?
3. Mají se zavést známky 1–5, A, N? Spec v projektu chybí.

## D) Doporučené první kroky
1. Etapa 1 (bez SQL), nasaditelná samostatně: panel vyhodnocení z dat po tématech, jen pro učitele.
2. Etapa 3 bez ukládání: AI návrh „co opakovat“ jako dočasný koncept s odkazem do procvičování.
3. Teprve po schválení SQL etapy 2 a 4: verze závěru, zveřejnění žákovi a poznámky učitele.

Nic se nespouští, nemigruje ani nenasazuje.
