# Část H – „Učím se“: diagnostika a návrh (bez DB)

Stav: pouze diagnostika, nic se neměnilo.

## 1. Jak procvičování probíhá dnes
- `study_methods` (sloupce: id, name, slug, description, steps_json, icon, created_at). Každá z 8 technik má v `steps_json` 4–6 kroků (jen `name` a `description`). Příklady: Pomodoro „Vyber úkol / Nastav 25 minut / 5 minut…“, SQ4R 6 kroků Survey→…
- Kroky se zobrazují jako návod na `/student/metody` (`src/pages/StudentMethods.tsx`, dialog s kroky).
- **Procvičení s lekcí** (`src/pages/StudentPractice.tsx:127-150`) volá `ai-practice-rag`. Kroky techniky se do AI vůbec neposílají, metoda jde jen jako slug v textu „METODA: …“.
  - Klient vytvoří vždy JEDNU fázi „Procvičování z lekce“ (ř. 142-146).
  - Všech 8 technik je tedy dnes stejné cvičení: přibližně 2/3 výběr z možností a 1/3 pravda/nepravda.
- **`ai-practice-rag` vrací** `{ lesson:{id,title}, target_difficulty:"easy|medium|hard", questions:[{type:"multiple_choice",text,options,correct_index,difficulty,topic} | {type:"true_false",text,correct_answer:boolean,...}], recommendation }`.
  - Obtížnost se odvozuje z XP úrovně a posledních 5 sezení.
  - Každé volání uloží doporučení do `student_practice_recommendations`.
- **Bez lekce** se volá `generate-practice`, které posílá `steps_json` do AI a může vrátit víc fází. Z lekce se ale nikdy nevolá (ř. 152).
- **Pomodoro nemá časovač.** U karty je jen štítek „25 min“ z `src/lib/study-method-info.ts`. `setInterval` ani timer v `StudentPractice`/`StudentMethods` není.

## 2. Prázdná „Správná odpověď:“ u pravda/nepravda
- `src/pages/StudentPractice.tsx:588-590`: podmínka `q.correct_answer && …` a výpis `{q.correct_answer}`.
- Když je správně `false`, podmínka je nepravdivá, takže řádek chybí.
- Když je správně `true`, React boolean nevykreslí, takže řádek je, ale prázdný.
- Oprava: pro `true_false` zobrazit „Pravda“/„Nepravda“, podmínku ověřovat přes `!== undefined`.

## 3. „Zvládnutí lekce“ 0 % — chyba, ne záměr
- Výpočet (ř. 271-318): vážený průměr `answers_json.percent` z posledních 3 sezení (váhy 3/2/1). „Zvládnuto“ znamená ≥ 85 % a aspoň 2 sezení.
- Příčina: `handleSubmit` (ř. 233) zavolá `setSubmitted(true)` a hned v téže funkci použije `score`/`percent` z `useMemo` (ř. 214-226).
  - Ty jsou ještě z vykreslení, kdy `submitted` bylo `false`, takže `score = 0` (ř. 215).
  - Do `student_practice_sessions` se proto uloží `score 0` a `percent 0`, a z toho mastery 0.
  - `sessions_count` se zvyšuje správně.
- Na obrazovce je 3/4, protože po překreslení se skóre spočte znovu.
- Oprava: spočítat skóre přímo v `handleSubmit` stejnou funkcí `evaluate`.
- Stará chybná sezení se nepřepisují. Mastery se samo opraví dalšími sezeními, protože se počítá jen z posledních 3.

## 4. Anglický text a nevhodná hláška
- „Cílová obtížnost: easy“ je v `StudentPractice.tsx:144`. Navrhuji převod na základní / střední / náročnější.
- „Otevřené odpovědi se nehodnotí automaticky…“ je na ř. 433-435. Zobrazuje se vždy, když existuje hodnocená otázka. Má se ukázat jen při `allQuestions.some(q => q.type === "open")`.

## 5. Zdroje materiálu — co existuje
- **Text lekce:** `_shared/lesson-text.ts`, funkce `blocksToText` a `cleanLessonText`. Pod minimem textu vrací 422 (`INSUFFICIENT_LESSON_TEXT`). `generate-practice` text ořízne na 8000 znaků.
- **Přístup k lekci:** `loadPracticeLesson` ověřuje přístup přes klienta volajícího (RLS).
- **Vlastní text, soubor nebo foto:** existují `process-file-content` (extrakce textu ze souboru, používá ho `TeacherSuggestByMethod.tsx:409`), `generate-content-from-material` a `src/components/from-material/FromMaterialView.tsx` („Z materiálu“).
  - Jestli `process-file-content` umí OCR fotky a jestli ho smí volat žák, jsem neověřila.
- **Stránka sešitu:** `notebook_pages.content.textBoxes[].text` je čistý text, lze ho číst bez AI.
  - Rukopis (`strokes`) a obrázky jsou jen kresba. Text z nich dostaneme jen rasterizací stránky (sdílený renderer exportu) a rozpoznáním přes AI vision.
  - RLS: jen vlastník (`owns_notebook`).
- **Portfolio:** `student_portfolio_items` spravuje žák sám. Vidí ho jeho učitel, rodič a admin. Platí demo `demo_iso` RESTRICTIVE.
- **Soukromí procvičování:**
  - `student_practice_sessions` vidí žák, jeho učitel a admin. Žák smí vkládat a mazat.
  - `student_lesson_mastery` vidí žák, učitel, rodič a admin.
  - `student_practice_recommendations` vidí žák a admin.
  - Demo RESTRICTIVE politiky na těchto tabulkách v seznamu politik nejsou; zda je to v pořádku, jsem neověřila.
- **Demo AI limit:** `_shared/demo-ai-guard.ts` je volaný na začátku `ai-practice-rag`/`generate-practice`. Měří jen demo uživatele, limity jsou v `demo_config`.

## 6. Návrh minimální architektury (bez DB)
```text
zdroj = lekce | text | soubor/foto | stránka sešitu | portfolio
   → klient/edge: získat čistý text (max 8000 znaků)
   → ai-practice-rag { lesson_id? | source_text + source_kind, method }
   → fáze podle steps_json techniky (2–4 fáze), otázky mc/tf/open
```
- **H1 – opravy (jen klient, bez DB):** skóre v `handleSubmit`, odpověď u P/N, česká obtížnost, hláška jen u otevřených otázek. Test pro každou opravu.
- **H2 – fáze podle techniky:** `ai-practice-rag` dostane `steps_json` a vrátí `phases[]`. Klient pak nevytváří jednu fázi. Pomodoro dostane lokální časovač 25/5 min bez ukládání.
- **H3 – vlastní text:** `source_text` místo `lesson_id`. Sezení se uloží s `lesson_id null` a `answers_json.source = { kind }`, bez kopie textu, aby se v DB neukládal žákův text navíc. Mastery jen u lekcí.
- **H4 – stránka sešitu:** text boxy čte klient (RLS vlastníka). Rukopis volitelně přes rasterizaci a AI vision, jen se souhlasem žáka; obrázek se nikam neukládá.
- **H5 – soubor, foto, portfolio:** pokud `process-file-content` žák smí volat, použít ho; jinak nová edge funkce s `demoAiGuard`.
- Migrace není potřeba. Pokud by se mělo ukládat, z jakého zdroje se procvičovalo, stačí `answers_json`.

## 7. Rizika
- **XP:** XP za procvičování jsem v `StudentPractice` nenašla. Podle pravidla projektu jen přes `add_xp`; neměnit.
- **Dashboard „Dnes“ a studijní lišta u lekce:** čtou sezení a mastery. Oprava skóre změní zobrazené hodnoty (začnou být správné), formát zůstane.
- **Kartičky a kvíz** používají `lesson-study-helper`, ne `ai-practice-rag`. Změna struktury v H2 se jich nedotkne, pokud zůstane pole `questions` jako fallback.
- **Výkon:** delší prompt s fázemi zvýší čas generování.
- **Demo:** každá nová AI cesta musí volat `demoAiGuard`.

## Rozhodnutí pro učitelku
1. Začít jen opravami H1, nebo hned i fázemi podle techniky (H2)?
2. Rukopis ze sešitu číst přes AI (H4), nebo zatím jen textová pole?
