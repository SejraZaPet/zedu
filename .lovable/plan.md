# Tahák (žákovský jednostránkový přehled) – diagnostika a návrh

Pouze návrh. Nic se neimplementuje, DB se nemění, žádné e-maily ani nasazení. Myšlenkové mapy dál čekají na „schvaluji“.

## 1. Co už existuje a dá se využít

| Oblast | Kde | Využití pro tahák |
|---|---|---|
| Lišta učení u lekce: Kartičky / Kvíz / Shrnutí | `components/lesson/LessonStudyBar.tsx` (v `LessonPage`, `StudentTextbookDetail`) | sem přidat tlačítko „Tahák“ |
| AI shrnutí a kartičky z lekce | edge `lesson-study-helper` (režimy `cards`, `summary`; demo hlídá `demo-ai-guard`), `src/lib/lesson-study.ts` (`blocksToPlainText` max 6000 znaků, `extractCardsFromBlocks`, max 15 kartiček) | základ AI návrhu i ručního výběru pojmů bez AI |
| Bloky učebnice | `textbook-config.ts` (definice, `summary`, `callout`, `formula`, `table`, `image`…) | zdroj pojmů, vzorců a obrázků k přetažení |
| Sešit | `lib/notebook.ts`, `notebook_pages` (A4 1000×1414, text, obrázky, kreslení), `worksheet-notebook.ts` vkládá pracovní list jako stránku | tahák lze vložit jako stránku sešitu (obrázek/podklad) |
| Portfolio | `lib/portfolio.ts` – druhy `worksheet_result`, `project`, `reflection`, `upload` | odevzdaný tahák jako `upload`/`project` |
| Tisk/PDF | `worksheet-pdf-export.ts`, `worksheet-print-renderer.ts`, `activity-pdf-export.ts`, `window.print` | stejné A4 vykreslení |
| Zkoušky | `lib/exam-types.ts` (`ustni`, `pisemne`, `digitalni`, `projekt`, `prace_v_hodine`), `UpcomingExamsCard` | „Připrav si tahák“ u blížící se písemky |
| Úkoly | `assignments` + `assignment_attempts.answers`, kinds úkol/materiál | „Vytvoř si tahák“ jako úkol s hodnocením |
| Offline | `public/sw.js`, `manifest.json`, `lesson-offline-export.ts` | uložený tahák dostupný v mobilu |

Tahák ani Cornellovy poznámky zatím v aplikaci nejsou.

## 2. Jak má tahák vypadat a vznikat

**Vzhled:** A4, výchozí jedna strana (volitelně oboustranně), 2 nebo 3 sloupce, rámečky pojmů, písmo min. 9 pt v tisku (výchozí 10 pt), přepínač černobílý/barevný tisk, barvy z Bezli tokenů, zvýraznění. V mobilu jeden sloupec se sbalitelnými rámečky.

**Druhy rámečků:** pojem + definice, vzorec, příklad, obrázek/schéma, tabulka, časová osa, slovíčko (cizí jazyk – překlad), postup (číslované kroky), mini myšlenková mapa (až po etapě map).

**Šablony:** „Definice + příklad“, „Vzorce“, „Časová osa“, „Slovíčka“, „Postup / Recept“ (gastro: suroviny, gramáž, postup, teplota, HACCP), „Prázdný“.

**Vznik:**
- a) **Žák sám**: vybere pojmy z lekce (zaškrtávací seznam z bloků), přidá vlastní text, přeskupí rámečky (`@dnd-kit`, na dotyk tlačítka nahoru/dolů).
- b) **AI návrh**: nový režim `cheatsheet` ve stávající `lesson-study-helper` – jen kostra (např. max 8 rámečků, krátké heslovité texty), žák ji musí upravit. Označeno „AI generováno“. Náklady: jedno volání levného modelu, demo omezeno stávajícím `demo-ai-guard`. Doporučení: AI nabídnout až po ručním výběru pojmů, aby se žák učil.
- c) **Učitel**: připraví šablonu/vzor a zadá ji jako materiál nebo úkol „Vytvoř si tahák“ (s pravidly: počet stran, zda je povolena AI).

**Limity:** max ~20 rámečků, max 300 znaků na rámeček, ukazatel „vejde se na 1 stranu“.

## 3. Kde v aplikaci

| Místo | Soubor | Co |
|---|---|---|
| U lekce | `LessonStudyBar.tsx` | tlačítko „Tahák“ vedle Kartičky/Kvíz/Shrnutí |
| „Učím se“ / Můj den | stránka žákova učení | seznam mých taháků |
| Příprava na test | `UpcomingExamsCard.tsx` | „Připrav si tahák“ k písemce |
| Sešit | `worksheet-notebook.ts` cestou | „Vložit do sešitu“ jako stránka |
| Portfolio | `portfolio.ts` | „Přidat do portfolia“ |
| Úkol | `TeacherAssignments`, `StudentAssignments`, `TeacherResults` | úkol „Vytvoř si tahák“, odevzdání, ruční hodnocení (rubrika `RubricEvaluator`) |
| Tisk/PDF/offline | nový `cheatsheet-print.ts` + `sw.js` | tisk, PDF, uložení do mobilu |

## 4. Data, oprávnění, AI

**Varianta A – bez DB (doporučená pro etapu 1):** tahák uložený jako stránka sešitu (`notebook_pages.content` JSON rozšířený o `cheatsheet`) nebo u úkolu v `assignment_attempts.answers`. Oprávnění dědí existující: sešit vidí jen žák, učitel jen odevzdaný úkol.

**Varianta B – nová tabulka (lepší pro seznam taháků, šablony učitele a sdílení):**
```sql
-- NÁVRH, NESPOUŠTĚT
create table public.student_cheatsheets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  lesson_id uuid, assignment_id uuid,
  title text not null check (char_length(title) <= 120),
  data jsonb not null default '{}',
  ai_generated boolean not null default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
grant select, insert, update, delete on public.student_cheatsheets to authenticated;
grant all on public.student_cheatsheets to service_role;
alter table public.student_cheatsheets enable row level security;
-- vlastník vše; učitel jen čtení, je-li assignment_id jeho úkolu a pokus odevzdán;
-- RESTRICTIVE demo_guard_* a demo_iso dle existujícího vzoru.
-- rollback: drop table public.student_cheatsheets;
```

**Soukromí:** žák vidí jen své; učitel jen odevzdané; rodič ne (lze rozhodnout jinak). Demo: zápisy dle stávajících demo politik, AI dle `demo_config`.

## 5. Rizika a testy

- **Obcházení u písemek**: tahák je jen papír/obsah; aplikace nehlídá, zda je u písemky povolen. Doporučení: u zkoušky učitel jen vyznačí „povolen tahák (1 strana A4)“ – informace, ne zámek.
- **Délka**: limity rámečků a ukazatel stránky; AI krátká kostra.
- **Tisk**: pevné A4 rozvržení, kontrola přetečení.
- **Mobil**: cíle ≥ 44 px, 390 px bez vodorovného posunu, přetahování nahrazené tlačítky.
- **Testy**: model a limity, výběr pojmů z bloků, rozložení „vejde se na stranu“, šablony, AI normalizace, oprávnění (pokud tabulka), tisk; Playwright 390/1440 px.

## 6. Etapy

1. **Nejmenší krok (jen frontend, bez DB):** tlačítko „Tahák“ u lekce → editor s šablonami, výběr pojmů z lekce, vlastní text, náhled A4, tisk/PDF, uložení do sešitu jako stránka. Bez AI.
2. AI návrh (režim `cheatsheet` ve stávající funkci), vložení do portfolia, offline.
3. Úkol „Vytvoř si tahák“ s odevzdáním a hodnocením; u zkoušky štítek „povolen tahák“.
4. (S DB, volitelně) samostatná tabulka, seznam taháků, šablony učitele, sdílení.

Nové soubory (etapa 1): `src/lib/cheatsheet.ts` (model, šablony, limity, výběr z bloků), `src/lib/cheatsheet-print.ts`, `src/components/cheatsheet/CheatsheetEditor.tsx`, `CheatsheetPreview.tsx`, úprava `LessonStudyBar.tsx`, testy v `src/test/`.

## Na čem se rozhodnout
1. Schválit etapu 1 (tahák u lekce, bez AI, ukládání do sešitu)?
2. Ukládat do sešitu (bez DB), nebo rovnou samostatná tabulka?
3. AI návrh: ano až v etapě 2, a jen po ručním výběru pojmů?
4. Smí rodič tahák vidět?
5. Výchozí: 1 strana A4, 2 sloupce, 10 pt?
