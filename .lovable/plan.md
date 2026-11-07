# Tahák – krátké poznámky na kartě (bez AI) – návrh

Pouze návrh. Nic se neimplementuje, DB se nemění, žádné e-maily ani nasazení. Myšlenkové mapy i tahák čekají na „schvaluji“. Zjištění o existujícím kódu z předchozí diagnostiky platí (lišta Kartičky/Kvíz/Shrnutí v `LessonStudyBar.tsx`, výběr textu z bloků v `lesson-study.ts`, sešit `notebook_pages`, portfolio, tisk, `UpcomingExamsCard`, `assignment_attempts.answers`).

**AI je zcela vyřazena** – žádné generování, návrhy ani volání AI funkcí.

## Názvy a texty (neutrální)

Doporučené varianty:
1. **„Tahák – krátké poznámky“** (doporučuji; slovo žáci znají, dovětek ho zneutrálňuje).
2. **„Mini poznámky“**.

Popis: „Malá karta na krátké poznámky z lekce – zkratky, hesla, šipky, symboly. Je to volitelná možnost; můžeš si ji vytisknout nebo mít v mobilu.“
Texty nesmí tvrdit, že tahák zlepšuje učení nebo výsledky, ani ho spojovat s obcházením písemek. Funkce je nenápadná: položka v nabídce „Další ⋯“, ne hlavní tlačítko.

## 1. Formát karty

- Rozměr **90 × 55 mm**, líc + rub, na výšku i na šířku (výchozí na šířku).
- Vnitřní okraj 3 mm, užitná plocha 84 × 49 mm.
- Písmo v tisku min. **7 pt** (výchozí 8 pt, nadpis 9 pt tučně), řádkování 1,15.
- Max **8 řádků / odrážek na stranu**, max **220 znaků na stranu**; ukazatel „vejde se / přetéká“, přetékající text se netiskne a je zvýrazněn.
- Stálá nápověda: „Piš stručně: zkratky, body, šipky, symboly.“

**Šablony stran** (lze kombinovat pro líc a rub):
- Prázdná (odrážky)
- Hesla – pojem → význam (2 sloupce)
- Vzorce (zarovnané řádky, horní/dolní index)
- Postup / Recept (číslované kroky; gastro: surovina–gramáž–teplota)
- Slovíčka (slovo – překlad)
- Časová osa (rok → událost)

## 2. Tvorba – výhradně ručně

- Žák píše sám. Tlačítko „Vložit z lekce“ ukáže pojmy/nadpisy z bloků lekce; vybraný se vloží **jen jako prostý text**, který si žák zkrátí (bez formátování, bez obrázků).
- Panel **zkratek a symbolů** ke vložení: → ← ↑ ↓ ⇒ ≈ ≠ ≤ ≥ ± ° °C Δ ∑ ✓ ✗ ! ? … , zkratky „tzv., např., tj., cca, min., max.“ Žák si může přidat vlastní oblíbené (uloženo u něj v prohlížeči).
- Zvýraznění: tučně, podtržení, jedna barva zvýrazňovače.
- Přepínač Líc / Rub, otočení karty náhledem.

## 3. Tisk a zobrazení

- **Arch A4: 10 karet** (2 sloupce × 5 řádků = 180 × 275 mm), okraje 15 mm vlevo/vpravo, 11 mm nahoře/dole, ořezové značky v rozích.
- **Oboustranný tisk:** list 1 = líce, list 2 = ruby zrcadlově prohozené sloupce (otáčení po delší straně), takže rub sedí na líc; zkušební tisk s rámečkem „kontrola zarovnání“.
- Tisk jedné karty, celého archu nebo opakování jedné karty 10×.
- PDF přes stávající tiskovou cestu (`window.print` s `@page A4`), černobíle i barevně.
- Mobil: karta přes šířku displeje ve skutečném poměru 90:55, ťuknutím otočit, cíle ≥ 44 px, 390 px bez vodorovného posunu.

## 4. Kde v aplikaci, oprávnění

| Místo | Co |
|---|---|
| U lekce (`LessonStudyBar.tsx`) | „Tahák – krátké poznámky“ v nabídce „Další ⋯“ |
| Příprava na test (`UpcomingExamsCard.tsx`) | nenápadný odkaz „Moje taháky k předmětu“ (jen pokud učitel u zkoušky tahák uvedl, viz níže) |
| Sešit | „Vložit do sešitu“ – stránka s kartou |
| Portfolio | „Přidat do portfolia“ (etapa 3) |
| Úkol „Vytvoř si tahák“ | úkol s odevzdáním karty, učitel ji vidí a hodnotí ručně (etapa 3) |

**Soukromí:** žák vidí jen své taháky. Učitel vidí tahák jen tehdy, když ho žák odevzdá v úkolu. Rodič nevidí. Demo dědí stávající demo ochrany.

**Nastavení učitele „Povolen tahák“ u písemky:** jen evidence – štítek „Tahák povolen (1 karta 90 × 55 mm)“ u zkoušky, který žák vidí. Žádná kontrola ani vynucení. Ukládat do stávajícího nastavení zkoušky/úkolu (`settings.cheatsheetAllowed`), chybějící klíč = neuvedeno. Doporučuji zařadit až do etapy 3; kdo nechce, nemusí ho používat.

## 5. Datový model

**Varianta A – bez DB (doporučeno pro etapy 1–2):**
- Tahák ve vlastním sešitu žáka: `notebook_pages.content` + klíč `cheatsheet` `{ version:1, orientation, front:{template, lines[]}, back:{template, lines[]}, lessonId? }`; oprávnění dědí sešit (jen žák).
- Odevzdání v úkolu: stejný JSON v `assignment_attempts.answers.cheatsheet`; oprávnění dědí pokusy.

**Varianta B – nová tabulka (jen návrh, pro seznam taháků napříč lekcemi):**
```sql
-- NÁVRH, NESPOUŠTĚT
create table public.student_cheatsheets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  lesson_id uuid,
  title text not null default '' check (char_length(title) <= 80),
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.student_cheatsheets to authenticated;
grant all on public.student_cheatsheets to service_role;
alter table public.student_cheatsheets enable row level security;
create policy cs_owner on public.student_cheatsheets for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- + RESTRICTIVE demo_guard_* / demo_iso podle existujícího vzoru
-- rollback: drop table public.student_cheatsheets;
```
Učitel do tabulky přístup nemá; odevzdání jde vždy kopií do pokusu úkolu.

## Rizika

- Přetečení textu na malé kartě → pevné limity a ukazatel.
- Zarovnání líce a rubu se liší podle tiskárny → zkušební arch a návod.
- Čitelnost 7 pt → nedovolit menší písmo.
- Nevhodné vnímání („k podvádění“) → neutrální texty, nenápadné umístění, učitelský štítek jen informativní.
- Mobil ≥ 44 px, 390 px bez vodorovného posunu.

## Testy

Limity řádků/znaků, rozmístění 10 karet na A4 a zrcadlení rubu, vložení pojmu z lekce jako prostý text, šablony, ukládání do sešitu, chybějící `cheatsheetAllowed` = neuvedeno, slovník textů bez zakázaných formulací; Playwright 390/1440 px a náhled tisku.

## Etapy

1. **Nejmenší krok (jen frontend, bez DB):** položka u lekce, editor karty líc/rub se šablonami, panel symbolů, vložení pojmu z lekce, uložení do sešitu, tisk jedné karty i archu 10 karet.
2. Seznam mých taháků v „Učím se“, vlastní oblíbené zkratky, vložení do portfolia.
3. Úkol „Vytvoř si tahák“ s odevzdáním a ručním hodnocením; štítek „Tahák povolen“ u písemky (jen evidence).
4. (Volitelně, s DB) samostatná tabulka.

Soubory (etapa 1): `src/lib/cheatsheet.ts` (model, šablony, limity, symboly), `src/lib/cheatsheet-print.ts` (A4 arch, zrcadlení), `src/components/cheatsheet/CheatsheetEditor.tsx`, `CheatsheetCard.tsx`, `CheatsheetSymbolPanel.tsx`, úprava `LessonStudyBar.tsx`, testy v `src/test/`.

## Na čem se rozhodnout
1. Název: „Tahák – krátké poznámky“, nebo „Mini poznámky“?
2. Limity: 8 řádků / 220 znaků na stranu, písmo min. 7 pt?
3. Štítek „Tahák povolen“ u písemky: zařadit (etapa 3), nebo vynechat?
4. Ukládat do sešitu bez DB?
5. Schvalujete etapu 1?
