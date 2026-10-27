
### Část H – stav implementace (27. 10. 2026)
- H1 hotovo (beze změny).
- H2 hotovo v kódu: definice fází 8 technik v `supabase/functions/_shared/practice-phases.ts` (server, ne AI); `ai-practice-rag` vrací `phases[]` + zpětně kompatibilní `questions`; UI ve `StudentPractice.tsx` (osnova, čtení, klíčové body po vyhodnocení, akrostik kontrola, loci zastávky jen v relaci, sekvenční odemykání ≥ 70 %, Pomodoro `PomodoroTimer.tsx` z časových razítek). Logika v `src/lib/practice-method.ts`.
- H3 hotovo: zdroj Vlastní text (max 8000, min 150) a Soubor (PDF/.txt čtený v prohlížeči). Foto skryto: `process-file-content` nemá demo AI limit. Portfolio skryto: položky nemají text (jen skóre/odkazy).
- H4 hotovo: stránka sešitu – jen `textBoxes[].text` (bez seznamu třídy), bez rukopisu.
- Sezení z vlastního zdroje: `lesson_id` null, `answers_json.source = { kind }`, fáze bez textu; mastery jen lekce. Bez DB migrace.
- Edge funkce `ai-practice-rag` NENASAZENA (čeká na pokyn); do nasazení vlastní zdroje hlásí chybu a lekce mají jednu fázi.
- „Uložit do sešitu“ vynecháno (funkce vložení textu do sešitu neexistuje).

### H – doplněk: vysvětlení ze zdroje u otevřených otázek (hotovo v kódu, nenasazeno)
- `_shared/practice-phases.ts`: `verifySourceQuote` (normalizace mezer/diakritiky/uvozovek), `buildSourceExplanation` (fallback z key_points, `summary_only`), `attachExplanations`, `SOURCE_ONLY_RULE`, `openExplanationSpec`.
- `ai-practice-rag`: prompt vyžaduje `open_explanations` po fázích + volitelné vysvětlení u mc/tf; zákaz vlastních znalostí.
- `StudentPractice.tsx`: blok „Vysvětlení ze zdroje (z lekce X / z tvého textu)“ po odevzdání, „Ukázat vysvětlení“ u prázdné odpovědi, u chybné uzavřené odpovědi pokud existuje; nová hláška. Skóre/mastery/XP beze změny.
- Testy: `src/test/practice-explanations.test.ts`.
