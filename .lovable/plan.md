# Prezentace: filtrování a sdílená lišta filtrů

Pouze návrh. Nic se nenasazuje a žádné SQL se nespouští.

## 1. Co seznam prezentací umí dnes
Seznam je na stránce `src/pages/TeacherPresentations.tsx`.
- Data se čtou z tabulky `teacher_presentations`. Načítá se jen název, snímky, `lesson_id`, `source_lesson_id`, `source_lesson_type`, datum vytvoření a datum úpravy, a jen prezentace přihlášeného učitele.
- Pořadí je pevné: naposledy upravené nahoře. Učitel ho nemůže změnit.
- **Seznam nemá vyhledávání, filtry ani skupiny.** Vyhledávací pole na stránce slouží jen v dialogu „Propojit s lekcí“, kde se hledá učebnice nebo lekce.
- Názvy propojených lekcí se dočítají z tabulek `teacher_textbook_lessons` a `textbook_lessons`.
- Tabulka **nemá** předmět, třídu, štítky, stav ani oblíbené. Má jen příznak ukázkové prezentace `is_demo_seed`.

## 2. Které filtry jdou bez změny databáze
| Filtr | Bez změny databáze? | Odkud se vezme |
|---|---|---|
| Hledání v názvu | ano | `title`, případně i název propojené lekce |
| Zdroj (z lekce / vlastní) | ano | vyplněné `lesson_id` nebo `source_lesson_id` znamená „z lekce“, jinak „vlastní“ |
| Zdroj „z materiálu“ | ne spolehlivě | nikde se neukládá, že prezentace vznikla z materiálu |
| Datum úpravy | ano | `updated_at`: dnes, 7 dní, 30 dní, starší |
| Řazení | ano | naposledy upravené, název A–Z, nejnovější |
| Předmět | ano, nepřímo | z lekce přes učebnici a `subject_id`, jedním souhrnným dotazem. Vlastní prezentace bez lekce spadnou do „Bez předmětu“ |
| Třída | ne | prezentace se s třídou nikde nepropojuje |
| Oblíbené | jen jako dočasná náhrada | v prohlížeči by se oblíbené na jiném zařízení ztratily. Správné řešení potřebuje nové pole |

Návrh SQL k pozdějšímu schválení, nespouštět:
```sql
ALTER TABLE public.teacher_presentations
  ADD COLUMN is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN origin text,        -- 'lesson' | 'own' | 'material' | 'ai'; vyplňuje se při vytvoření
  ADD COLUMN subject_id uuid;    -- volitelné, předmět u vlastních prezentací
-- Stávající pravidla vlastníka platí i pro nová pole. Demo ochrany zůstávají beze změny.
```

## 3. Návrh vzhledu
- Nad seznamem bude kompaktní lišta: hledání, Předmět, Zdroj, Upraveno a Řazení. Přepínače budou ve stejném stylu jako ostatní výběrová pole v Bezli.
- Pod lištou budou čipy aktivních filtrů, každý s křížkem, a tlačítko „Vymazat filtry“. Vedle bude počet výsledků, například „12 z 40“, který se přečte i čtečkám obrazovky.
- Na mobilu zůstane viditelné hledání a tlačítko „Filtry (N)“. To otevře vysouvací panel zespodu.
- Poslední filtr se zapamatuje v prohlížeči zvlášť pro každou sekci. Když uložená hodnota nedává smysl, filtr se vrátí na výchozí.
- Prázdný stav napíše „Filtrům nic neodpovídá“ a nabídne „Vymazat filtry“.

## 4. Sjednocení s dalšími sekcemi
- **Pracovní listy** mají hledání a vlastní přepínače stavu a druhu.
- **Hry** mají přepínače typu, účelu a předmětu.
- **Plány hodin** mají hledání a filtr předmětu.
- **Lekce** filtry nemají.
- Každá sekce to dnes řeší vlastní kopií. Sdílená komponenta `FilterBar` by používala existující vyhledávací pole `SearchField` a pomocné funkce pro hledání. Každá sekce by jí jen předala seznam filtrů. Paměť filtrů by obstarávala sdílená funkce `useStoredFilters`. Samotné filtrování by zůstalo v každé stránce, takže se nezmění, co učitel smí vidět, ani jak se data ukládají.

## 5. Rozsah a pořadí
1. **Sdílená komponenta, paměť filtrů a testy (S–M):** `src/components/filters/FilterBar.tsx`, `src/hooks/use-stored-filters.ts`, test.
2. **Prezentace (M):** `TeacherPresentations.tsx` dostane hledání, zdroj, datum, řazení a předmět přes učebnici, plus čisté funkce v `src/lib/presentation-filters.ts` s testem.
3. **Převedení dalších sekcí (M):** `TeacherWorksheets.tsx`, `TeacherGames.tsx` a `TeacherLessonPlans.tsx` přejdou na `FilterBar`. Jejich dnešní filtry a výchozí hodnoty zůstanou zachované.
4. **Volitelně po schválení SQL (S):** oblíbené, přesný zdroj a předmět u vlastních prezentací.

Kroky 1 a 2 jde zadat jedním promptem bez změny databáze. Krok 3 dává smysl jako samostatný prompt, protože je to převedení stávajících sekcí. Krok 4 přijde až po schválení SQL.

## Otázky pro Tynu
1. Mají vlastní prezentace bez lekce spadat do „Bez předmětu“? (ano/ne)
2. Stačí zatím oblíbené uložené jen v prohlížeči, nebo počkat na změnu databáze? (prohlížeč/počkat)
3. Převést hned i Pracovní listy, Hry a Plány hodin? (ano/ne)
