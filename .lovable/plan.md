# Úkoly: Odevzdané / Po termínu / Ke kontrole / Lze odevzdat po termínu

## Souhrn pro učitelku
- **Proč žák vidí „Po termínu“:** Odevzdaný úkol se mezi „Po termínu“ nedostane. Pořadí kontrol to nedovolí: odevzdání se kontroluje dřív než termín. V databázi ale je **206 rozpracovaných pokusů** po termínu, které žáci nikdy neodevzdali tlačítkem „Odevzdat“. Pravděpodobně si myslí, že je práce uložená, a tedy odevzdaná. Po termínu žádné odevzdání zatím není (0). Aplikace ho dnes neumožní, ovšem jen v prohlížeči.
- **Fáze 1 (bez databáze):** nové kategorie pro žáka i učitele, štítky „Odevzdáno po termínu“ a „Odevzdalo 18/24“ s barvou a vždy s textem. Rozpracovaná, ale neodevzdaná práce dostane štítek „Rozpracováno – neodevzdáno“.
- **Fáze 2 (malá změna databáze, jen se schválením):** volba „Lze odevzdat po termínu“. Uloží se do stávajícího nastavení úkolu, bez nového sloupce. Pravidlo navíc ohlídá databáze. Stávající úkoly se budou chovat jako dnes, tedy po termínu odevzdat nepůjde.
- Testovací žák ani demo uživatelé se do počtů „Odevzdalo X/Y“ nezapočítají.

## 1. Jak to funguje dnes
- Stavy počítá jedno místo: `src/lib/assignment-status.ts` (`assignmentStatus`). Pořadí: připravuje se → vše ohodnoceno („Ohodnoceno“) → vše odevzdáno („Čeká na hodnocení“) → termín minul („Po termínu“) → do 24 h („Končí dnes/zítra“) → „K odevzdání“.
- Skupiny `ASSIGNMENT_GROUPS`: K odevzdání, Odevzdáno, Po termínu, Ohodnoceno, Připravuje se. Zobrazuje je `AssignmentStatusGroups.tsx`. Stav sbalení skupin platí jen pro aktuální relaci.
- Žák: `StudentAssignments.tsx` (Moje úlohy), `TodayWidget.tsx`, `StudentSubjectClass.tsx`. Pokusy načítá `student-assignment-attempts.ts`, včetně skupinových. Kalendář žáka úkoly podle stavu netřídí.
- Učitel: `TeacherAssignments.tsx` a `TeacherSubjectClass.tsx` počítají `assignmentClassProgress`, tj. odevzdáno/ohodnoceno/celkem. Členy čtou z `class_members.user_id` nebo `subject_group_members.student_id`. U sdílených skupin úkolu používají `assignment_group_members`.
- Pro učitele je dnes úkol „Po termínu“, dokud neodevzdají všichni. Kategorie „Ke kontrole“ chybí.
- Data:
  - `assignments`: termín je `deadline`, dále `settings jsonb`, `max_attempts`, `status`, `exam_type`, `group_mode`. Nastavení „allow_late“ neexistuje.
  - `assignment_attempts`: `status` (in_progress/submitted), `submitted_at`, `score` (null = neohodnoceno), `max_score`, `teacher_feedback_at`. Sloupec typu needs_review neexistuje. Otevřené otázky se dnes poznají podle `score = null`.
- Termín hlídá jen prohlížeč: `StudentAssignmentPlayer.tsx` ř. 208–290 (toast „Termín vypršel“, po termínu jen prohlížení). Pravidla přístupu v databázi termín nekontrolují. Žák by technicky mohl rozpracovaný pokus odevzdat i po termínu.
- Při odevzdání běží tyto automatické akce: XP (`add_xp`), upozornění učiteli, rodičům a portfolio. Fáze 1 je nemění.

## 2. Kdo se počítá do „odevzdalo“
- Testovací žák je skrytý v `class_members`, `subject_group_members` a `profiles` (I2a). Učitel ho tedy v počtu nedostane.
- Demo účty vidí jen data svého páru, takže skuteční učitelé je nevidí.
- Navíc se na klientu použije `excludePreviewStudents`, pro jistotu.

## 3. Nové stavy (fáze 1)
Žák (vždy text, barva jen doplňuje):
| Kategorie | Pravidlo | Štítek |
|---|---|---|
| Čeká | neodevzdáno, termín neminul | „K odevzdání“ / „Končí dnes/zítra“ |
| Odevzdané | odevzdáno, bez bodů | „Odevzdáno“, při `submitted_at > deadline` navíc „Odevzdáno po termínu“ (oranžový) |
| Zkontrolované | odevzdáno a `score` není null | „18 / 24 b.“ (+ případně „Odevzdáno po termínu“) |
| Po termínu | termín minul a nic není odevzdáno | „Neodevzdáno“, a pokud existuje rozpracovaný pokus, „Rozpracováno – neodevzdáno“ |

Učitel:
| Kategorie | Pravidlo |
|---|---|
| Připravuje se | beze změny |
| Probíhá | termín neminul a nic ke kontrole |
| Ke kontrole | aspoň jedno odevzdání bez bodů |
| Zkontrolované | všechna odevzdání mají body a termín minul, nebo odevzdali všichni |
| Uzavřené | termín minul a nikdo neodevzdal (nic ke kontrole) |

Štítek „Odevzdalo X/Y“: zelená = všichni, oranžová = část, šedá = nikdo, červená = nikdo a termín minul. Barvy se vezmou z tokenů v `index.css` (kontrast AA) a přidá se ikona.

## 4. Fáze 2: „Lze odevzdat po termínu“
- Uložení: `assignments.settings.allowLate` (true/false), bez nového sloupce. Chybějící hodnota znamená false, takže stávající úkoly fungují jako dnes.
- Kde se nastavuje: zaškrtávátko ve formuláři úkolu v `TeacherAssignments.tsx` (vytvoření i úprava).
- Prohlížeč: když je `allowLate` zapnuté, přehrávač po termínu dovolí pokračovat a odevzdat a ukáže upozornění „Odevzdáváš po termínu“. Když je vypnuté, zůstane dnešní chování: jen prohlížení a hláška „Termín vypršel, úkol už nelze odevzdat.“
- Server (návrh, NESPOUŠTĚT): trigger, který odmítne odevzdání po termínu, pokud ho úkol nepovoluje.
```sql
CREATE OR REPLACE FUNCTION public.enforce_assignment_deadline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d timestamptz; allow boolean;
BEGIN
  IF NEW.status <> 'submitted' OR (TG_OP = 'UPDATE' AND OLD.status = 'submitted') THEN RETURN NEW; END IF;
  IF public.is_admin() OR public.is_admin_or_teacher(auth.uid()) THEN RETURN NEW; END IF;
  SELECT deadline, coalesce((settings->>'allowLate')::boolean, false) INTO d, allow
    FROM public.assignments WHERE id = NEW.assignment_id;
  IF d IS NOT NULL AND now() > d + interval '2 minutes' AND NOT allow THEN
    RAISE EXCEPTION 'deadline_passed' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_assignment_deadline() FROM PUBLIC, anon;
CREATE TRIGGER trg_enforce_assignment_deadline
  BEFORE INSERT OR UPDATE OF status ON public.assignment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_assignment_deadline();
```
Tolerance 2 minuty pokrývá odevzdání odeslané těsně před koncem. Před spuštěním se ověří přesná signatura `is_admin_or_teacher`.
Rollback:
```sql
DROP TRIGGER IF EXISTS trg_enforce_assignment_deadline ON public.assignment_attempts;
DROP FUNCTION IF EXISTS public.enforce_assignment_deadline();
```
- Riziko: dnes po termínu nikdo neodevzdává (0 záznamů), takže trigger nikoho neomezí. Po dobu tolerance se ale ještě ověří automatické odevzdání při vypršení časovače.

## 5. Rozsah, rizika, testy
- Fáze 1: `assignment-status.ts` (nové stavy a `submittedLate`), `AssignmentStatusGroups.tsx` (štítky), `StudentAssignments.tsx`, `TodayWidget.tsx`, `StudentSubjectClass.tsx`, `TeacherAssignments.tsx`, `TeacherSubjectClass.tsx` (předat `submitted_at` a `deadline`). Načítání pokusů doplní `submitted_at`.
- Beze změny zůstanou: notifikace, auto-připomínky, XP/liga, portfolio, rodičovský pohled a kalendář (nepoužívají `assignment-status`). Plánované úkoly (`settings.plan`) mají vlastní větev, ta se ověří testem.
- Riziko: uložený stav sbalení skupin pod starými klíči. Nové klíče skupin se prostě zobrazí rozbalené.
- Testy (`src/test/assignment-status*.test.ts`): odevzdáno po termínu ≠ „Po termínu“; rozpracováno po termínu = „Po termínu“ se štítkem „Rozpracováno – neodevzdáno“; score 0 = zkontrolováno; učitel „Ke kontrole“ při 1 neohodnoceném; „Odevzdalo 18/24“ a barva; testovací žák se do Y nepočítá; `allowLate` chybí = false.
- Kroky: Fáze 1 (jen kód, testy, ověření v prohlížeči jako žák a učitel) → schválení „schvaluji fázi 2“ → trigger + zaškrtávátko + přehrávač → testy. Nic se nenasadí bez pokynu „nasadit“.

## Otázky
1. Má se rozpracovaná, ale neodevzdaná práce po termínu zobrazit jako „Po termínu“ se štítkem „Rozpracováno – neodevzdáno“ (návrh), nebo ji chcete brát jako odevzdanou?
2. Má mít „Lze odevzdat po termínu“ i konečné datum (např. +7 dní), nebo stačí ano/ne?

---

# Druhá část: Materiály pro žáky, které se neodevzdávají

## Souhrn pro učitelku
- Dnes neexistuje samostatný „Materiál“. Učitel může soubory, odkazy, učebnice, prezentace nebo pracovní list předat jen třemi způsoby: jako **úkol** (přílohy `materials`), přes **příspěvek třídy**, nebo zprávou. Úkol ale vždy padá do stavů „K odevzdání“ a „Po termínu“. Proto materiál zadaný jako úkol vypadá jako nesplněná práce.
- V databázi je 14 úkolů bez termínu. Některé z nich jsou nejspíš právě takové „materiály“ (6 jen s obsahem, 4 jen s přílohami, 2 projekty a 2 práce v hodině s přílohami). Ukazují se jako „K odevzdání“.
- **Doporučení: varianta A** = nový druh „Materiál“ ve stávajících úkolech. Fáze 1 je bez databáze: druh se uloží do nastavení úkolu. Fáze 2 (pojistky v databázi) proběhne jen po schválení.

## 1. Jak se dnes sdílí věci bez odevzdání
| Co | Kde je uloženo | Kde to žák vidí | Termín / „Co mě čeká“ | Plete se s úkolem? |
|---|---|---|---|---|
| Přílohy úkolu (soubory, odkazy, lekce) | `assignments.materials` | Moje úlohy, předmět (`AssignmentMaterialsList`), Dnes | podle úkolu | **ano**, je to úkol |
| Úkol bez termínu / „Práce v hodině“ | `assignments` (`exam_type`, `deadline` null) | Moje úlohy, předmět, Dnes | bez termínu, ale „K odevzdání“ / „V hodině“ | **ano** |
| Plán testu/úkolu | `assignments.settings.plan` bez obsahu | předmět, kalendář, Nadcházející testy | ano | záměrně ano (je to ohlášení) |
| Učebnice třídě/skupině | `class_textbooks`, `subject_group_textbooks`, `class_subject_textbooks` | předmět, Moje učebnice | ne | ne |
| Prezentace / lekce v plánu | `teacher_presentations`, `lesson_plans` | předmět (plán hodiny) | jen přes plán hodiny | ne, ale jen v plánu hodiny |
| Pracovní list k tisku | `worksheets` | jen přes úkol nebo plán hodiny | podle toho | ano, když se zadá úkolem |
| Příspěvek třídy | `class_stories` | nástěnka třídy, rodič (`ParentClassStoriesFeed`), upozornění | ne | ne, ale chybí u předmětu a přílohy jsou omezené |
| Zpráva | `messages` + přílohy | messenger | ne | ne, ale ztratí se v konverzaci |

Typ „bez odevzdání“ dnes neexistuje (žádné `noSubmission` v kódu ani v datech). `exam_type` zná: úkol, práce v hodině, ústní, písemné, digitální, projekt.

## 2. Varianty
**A) Druh „Materiál“ ve stávajících úkolech (doporučeno)**
- Uložení: `assignments.settings.kind = "material"`. Termín, pokusy a hodnocení se u materiálu skryjí.
- Plus: použije stávající přílohy, oprávnění, třídu/skupinu/předmět, demo izolaci i kopírování. Fáze 1 nepotřebuje migraci.
- Minus: materiál je technicky úkol. Každé místo, které počítá úkoly (upozornění, připomínky, XP, statistiky), ho musí vědomě vynechat. Bez fáze 2 by žák mohl ručně založit pokus přes adresu (neškodné, ale nesprávné).

**B) Samostatná tabulka `class_materials`**
- Plus: úplně oddělené od úkolů, nic se nesplete, čisté do budoucna.
- Minus: nová tabulka, oprávnění, demo pravidla, úložiště, notifikace, kopie a rodičovský pohled. Velký zásah, několik schvalovacích kroků.
- Návrh SQL (NESPOUŠTĚT):
```sql
CREATE TABLE public.class_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.subject_groups(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id),
  title text NOT NULL, description text,
  items jsonb NOT NULL DEFAULT '[]', status text NOT NULL DEFAULT 'published',
  published_at timestamptz NOT NULL DEFAULT now(),
  is_demo_seed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((class_id IS NULL) <> (group_id IS NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_materials TO authenticated;
GRANT ALL ON public.class_materials TO service_role;
ALTER TABLE public.class_materials ENABLE ROW LEVEL SECURITY;
-- politiky: učitel vlastník/spoluučitel spravuje; člen třídy/skupiny a rodič čte published;
-- + RESTRICTIVE demo_guard_/demo_iso podle stávajících vzorů
```
Rollback: `DROP TABLE IF EXISTS public.class_materials;`

**C) Jen štítek na stávajících věcech**
- Plus: nejmenší změna.
- Minus: úkol se štítkem dál počítá „K odevzdání / Po termínu“, pokud se stejně nezmění stavy (tím se z toho stane varianta A). Učebnice a příspěvky se dál zobrazují jinde. Problém to nevyřeší.

## 3. Doporučení A: jak bude vypadat
- **Učitel:** tlačítko „Přidat“ nabídne **Úkol** (ikona schránky), **Materiál** (ikona knihy, `BookOpen`) a **Oznámení** (megafon, později, přes příspěvky třídy). U Materiálu formulář nabídne název, popis, přílohy (soubory, odkazy, lekce, učebnice, prezentace, pracovní list „k tisku“) a cíl (třída/skupina, předmět). Termín, pokusy ani body se nevyplňují. Volitelně: „Upozornit žáky“ (výchozí vypnuto).
- **Žák:** samostatná skupina **„Materiály“** u předmětu, v Moje úlohy (na konci) a v Dnes jen „Nový materiál“. Štítek „Materiál“ v neutrální barvě (`secondary`), bez stavových barev a bez termínu. Novinka má tečku a text „Nové“ (zapamatuje se v prohlížeči). Tlačítko „Otevřít“, žádné „Odevzdat“.
- **Kalendář:** materiál se nezobrazuje (nemá termín). Volitelně později jako tichý záznam v den zveřejnění.
- **Rodič:** vidí „Materiály“ dítěte jen ke čtení. Nepočítá se do nesplněných úkolů.
- **XP/liga, připomínky, upozornění „nový úkol“, statistiky odevzdání:** materiál se vynechá. Materiál nedává XP.
- **Demo a testovací žák:** platí stávající pravidla úkolů beze změny.

## 4. Fáze
- **Fáze 1 (bez DB):** `settings.kind`. Úpravy:
  - `assignment-status.ts`: nový stav „material“ mimo termíny a stavy
  - `AssignmentStatusGroups.tsx`: skupina „Materiály“
  - formulář v `TeacherAssignments.tsx`: volba druhu
  - `StudentAssignmentPlayer.tsx`: u materiálu jen zobrazení příloh, bez pokusu
  - `TodayWidget`, `StudentSubjectClass`, `UpcomingExamsCard` a kalendář: vynechat materiál z „K odevzdání“
  - `TeacherAssignments`: bez „Odevzdalo X/Y“
  - Lze převést i stávající úkol na materiál (úprava úkolu, učitelka sama).
- **Fáze 2 (DB, jen po „schvaluji“):** trigger zakáže pokus u materiálu. `add_xp`, `auto-reminders-job`, `notify_on_assignment` a statistiky (`class_engagement_stats`) vynechají `settings->>'kind'='material'`. Před úpravou se uloží rollback (původní definice + md5), stejně jako u I2b. Návrh triggeru:
```sql
CREATE OR REPLACE FUNCTION public.block_material_attempts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = NEW.assignment_id AND a.settings->>'kind' = 'material') THEN
    RAISE EXCEPTION 'material_has_no_submission' USING ERRCODE = 'P0001';
  END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.block_material_attempts() FROM PUBLIC, anon;
CREATE TRIGGER trg_block_material_attempts BEFORE INSERT ON public.assignment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.block_material_attempts();
```
Rollback: `DROP TRIGGER IF EXISTS trg_block_material_attempts ON public.assignment_attempts; DROP FUNCTION IF EXISTS public.block_material_attempts();`
- Do fáze 2 se ve fázi 1 skryje tlačítko „Nový úkol“ v upozornění u materiálů. Pokud server upozornění pošle, napíše „Nový úkol“. To je známé omezení fáze 1: buď se upozornění u materiálu dočasně vypne, nebo se fáze 2 spustí brzy.

## 5. Rizika a testy
- **Rizika:**
  - Zapomenuté místo, které materiál dál počítá jako úkol (statistiky, připomínky, export CSV/PDF, liga). Proto je fáze 2 nutná.
  - Kopie předmětu/třídy přenáší `settings`, takže materiál zůstane materiálem (ověřit).
  - Plán hodiny a „Plán testu“ (`settings.plan`) se nemění.
  - Staré úkoly bez `kind` = úkol, tedy beze změny.
- **Testy:**
  - materiál nemá stav „K odevzdání / Po termínu“
  - materiál je ve skupině „Materiály“
  - materiál se nepočítá do „Odevzdalo X/Y“
  - úkol bez `kind` beze změny
  - plán testu beze změny
  - přehrávač u materiálu nezaloží pokus
  - (fáze 2) trigger odmítne pokus a XP se nepřičte
- **Prohlížeč:**
  - učitelka vytvoří `[TEST]` materiál
  - žák ho vidí v Materiálech bez termínu
  - rodič ho vidí
  - úklid jen `[TEST]` záznamu.

## Otázky k materiálům
1. Varianta A (doporučeno), B, nebo C?
2. Má být „Oznámení“ součástí teď, nebo později (přes příspěvky třídy)?
3. Má být „Upozornit žáky“ u nového materiálu ve výchozím stavu zapnuté, nebo vypnuté?

---

# Třetí část: Rozhodnutí učitelky, Oznámení a společný plán fází

## Rozhodnutí (zapsáno)
- Materiál = varianta A (`assignments.settings.kind = "material"`). „Upozornit žáky“ je ve výchozím stavu **vypnuto**.
- Oznámení se zavede **teď** jako třetí druh.
- Odevzdání po termínu: **Ne** (výchozí) / **Ano do data** (+3, +7, +14 dní, vlastní datum) / **Ano bez omezení**.
- Rozpracovaná práce po termínu dostane štítek **„Po termínu – rozpracováno“**.

## Oznámení
**Kde uložit:** v úkolech jako `settings.kind = "announcement"`, ne v `class_stories`.
- Příspěvky třídy mají jen `class_id`, text a obrázek. Neumí skupinu, předmět, přílohy, připnutí ani platnost. Rozšířit je by vyžadovalo migraci a nová oprávnění.
- Úkoly už všechno potřebné mají: třídu/skupinu, předmět, přílohy, oprávnění žáků i rodičů, demo izolaci a kopírování. Všechny tři druhy se tak zadávají jedním formulářem.
- Příspěvky třídy zůstávají beze změny jako „nástěnka“ s fotkami.

**Čím se liší:**
| | Úkol | Materiál | Oznámení |
|---|---|---|---|
| Ikona / štítek | `ClipboardList` „Úkol“ | `BookOpen` „Materiál“ | `Megaphone` „Oznámení“ |
| Text | popis | popis | krátký text (do 500 znaků) |
| Přílohy | ano | ano (hlavní obsah) | volitelně 1–3 |
| Termín / odevzdání / body | ano | ne | ne |
| Připnutí | ne | ne | volitelně `settings.pinned` |
| Platnost | – | – | volitelně `settings.visibleUntil` (po datu se schová) |
| Upozornit žáky | ano (dnes) | výchozí vypnuto | **výchozí zapnuto** (volbu lze vypnout) |
| XP / statistiky / připomínky | ano | ne | ne |

**Učitel:** tlačítko **„Přidat“** nabídne **Úkol / Materiál / Oznámení**. Formulář zobrazí jen pole pro zvolený druh. V seznamu úkolů učitele jsou samostatné záložky „Materiály“ a „Oznámení“, bez „Odevzdalo X/Y“.

**Žák:**
- Předmět: nahoře připnutá oznámení, pak „Oznámení“, „Materiály“ a nakonec úkoly.
- Dnes: platná oznámení (max. 3) se štítkem „Oznámení“ a tečkou „Nové“.
- Moje úlohy: oznámení se tu neukazují, materiály jsou na konci.
- Kalendář: oznámení i materiál se nezobrazují.
- Rodič: platná oznámení a materiály dítěte jsou ke čtení v přehledu dítěte.
- Barva: neutrální `secondary`, vždy s textem štítku. Stavové barvy se nepoužijí.

**Upozornění:**
- Fáze 1: oznámení použije stávající upozornění na nový úkol. Text upozornění ale řeší server, takže dokud nebude fáze 2, přijde „Nový úkol: …“. Aby žáky nemátlo, posílá se ve fázi 1 upozornění u oznámení jen tehdy, když ho učitel zapne. Kvůli tomuto omezení je u oznámení ve fázi 1 výchozí stav **vypnuto**.
- Fáze 2: server pošle „Nové oznámení: …“ nebo „Nový materiál: …“ a výchozí stav oznámení se přepne na **zapnuto**.

## Odevzdání po termínu (upřesnění)
- Uložení: `settings.lateUntil`. Chybí = Ne (dnešní chování). `"unlimited"` = bez omezení. ISO datum = do data. Volby +3/+7/+14 dní se přepočítají z termínu na konkrétní datum.
- Žák po termínu:
  - pokud je odevzdání dovoleno: „Lze odevzdat do …“ a po odevzdání „Odevzdáno po termínu“
  - jinak: „Termín vypršel, úkol už nelze odevzdat.“
- Učitel vidí „Odevzdáno po termínu“ u každého takového pokusu.
- Trigger z první části se mění: místo `allowLate` čte `lateUntil`.
```sql
CREATE OR REPLACE FUNCTION public.enforce_assignment_deadline()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d timestamptz; late text; limit_at timestamptz;
BEGIN
  IF NEW.status <> 'submitted' OR (TG_OP = 'UPDATE' AND OLD.status = 'submitted') THEN RETURN NEW; END IF;
  IF public.is_admin() THEN RETURN NEW; END IF;
  SELECT deadline, settings->>'lateUntil' INTO d, late FROM public.assignments WHERE id = NEW.assignment_id;
  IF d IS NULL OR now() <= d + interval '2 minutes' OR late = 'unlimited' THEN RETURN NEW; END IF;
  limit_at := CASE WHEN late ~ '^\d{4}-\d{2}-\d{2}' THEN late::timestamptz END;
  IF limit_at IS NOT NULL AND now() <= limit_at + interval '2 minutes' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'deadline_passed' USING ERRCODE = 'P0001';
END $$;
REVOKE ALL ON FUNCTION public.enforce_assignment_deadline() FROM PUBLIC, anon;
CREATE TRIGGER trg_enforce_assignment_deadline
  BEFORE INSERT OR UPDATE OF status ON public.assignment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_assignment_deadline();
```
Učitelé odevzdání nezakládají, proto výjimku má jen admin. Před spuštěním se ověří automatické odevzdání při vypršení časovače.

## DB dopad oznámení
- Fáze 1: žádný. Používá se stávající `settings jsonb`.
- Fáze 2: pokus u oznámení i materiálu zakáže tentýž trigger:
```sql
CREATE OR REPLACE FUNCTION public.block_material_attempts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = NEW.assignment_id
             AND a.settings->>'kind' IN ('material','announcement')) THEN
    RAISE EXCEPTION 'no_submission_for_this_kind' USING ERRCODE = 'P0001';
  END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.block_material_attempts() FROM PUBLIC, anon;
CREATE TRIGGER trg_block_material_attempts BEFORE INSERT ON public.assignment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.block_material_attempts();
```

---

# SOUHRNNÝ PLÁN FÁZÍ

## Fáze 1: jen aplikace, bez DB (spustí se po „schvaluji fázi 1“)
1. **Stavy úkolů** (`src/lib/assignment-status.ts`):
   - Žák: Čeká / Odevzdané / Zkontrolované / Po termínu; štítky „Odevzdáno po termínu“ a „Po termínu – rozpracováno“.
   - Učitel: Připravuje se / Probíhá / Ke kontrole / Zkontrolované / Uzavřené; „Odevzdalo X/Y“ (zelená = všichni / oranžová = část / šedá = nikdo / červená = nikdo po termínu, vždy s textem).
   - Nový `assignmentKind(settings)` (úkol | materiál | oznámení); materiály a oznámení mimo stavy.
2. **Volba po termínu** ve formuláři úkolu: Ne / Ano do data (+3/+7/+14/vlastní) / Ano bez omezení. Přehrávač ji respektuje. Server ji vynutí až ve fázi 2; do té doby hlídá jen prohlížeč, stejně jako dnes termín.
3. **Přidat → Úkol / Materiál / Oznámení**, formuláře podle druhu, upozornění žáků (výchozí vypnuto u materiálu, ve fázi 1 i u oznámení).
4. **Zobrazení:** skupiny „Materiály“ a „Oznámení“, připnutí, platnost, tečka „Nové“ (paměť v prohlížeči), Dnes, předmět, Moje úlohy, rodič. Kalendář a „Nadcházející testy“ materiál ani oznámení nezobrazí.
5. **Přehrávač:** u materiálu a oznámení jen čtení a přílohy, nikdy nový pokus.

Soubory:
- `src/lib/assignment-status.ts`, nový `src/lib/assignment-kind.ts`
- `src/components/assignments/AssignmentStatusGroups.tsx`, nový `src/components/assignments/AssignmentKindBadge.tsx`
- `src/pages/TeacherAssignments.tsx`, `src/pages/TeacherSubjectClass.tsx`
- `src/pages/StudentAssignments.tsx`, `src/pages/StudentSubjectClass.tsx`, `src/pages/StudentAssignmentPlayer.tsx`
- `src/components/calendar/TodayWidget.tsx`, `src/components/student/UpcomingExamsCard.tsx`
- `src/lib/student-assignment-attempts.ts` (doplní `submitted_at`)
- rodičovský přehled dítěte (komponenta se ověří při implementaci)
- `src/index.css` (tokeny barev stavů)

Testy (vitest):
- odevzdáno po termínu ≠ „Po termínu“
- rozpracováno po termínu = „Po termínu – rozpracováno“
- skóre 0 = zkontrolováno
- učitel „Ke kontrole“ při 1 neohodnoceném
- „Odevzdalo 18/24“ a barva
- testovací žák mimo počet
- `lateUntil` chybí = Ne; +7 dní se přepočítá z termínu; „unlimited“
- materiál a oznámení mimo stavy a mimo „Odevzdalo X/Y“
- oznámení po `visibleUntil` se skryje; připnuté je první
- úkol bez `kind` a plán testu (`settings.plan`) beze změny
- přehrávač u materiálu nezaloží pokus

Ověření v prohlížeči:
- učitelka vytvoří `[TEST]` úkol, materiál a oznámení
- testovací žák a rodič je uvidí správně
- úklid jen `[TEST]` záznamů

Rollback fáze 1: vrátit uvedené soubory, data se nemění. Stávající úkoly nemají `kind` ani `lateUntil`, takže se chovají jako dnes.

## Fáze 2: databáze (spustí se po „schvaluji fázi 2“)
1. Uložit rollback soubory: původní definice + md5 všech měněných funkcí (`add_xp`/`trg_add_xp_assignment_attempt`, `notify_on_assignment…`, `notify_on_attempt_submitted`, `class_engagement_stats`, `school_engagement_overview`, `school_overview_stats`, a také edge funkci `auto-reminders-job`).
2. Migrace: `enforce_assignment_deadline` (`lateUntil`) + `block_material_attempts` (materiál/oznámení).
3. Migrace: vynechat `settings->>'kind' IN ('material','announcement')` z XP, upozornění na odevzdání, statistik a připomínek. Upozornění pro nový druh dostane text „Nové oznámení / Nový materiál“. Přesné úpravy se připraví čtením aktuálních definic jako balíček ke schválení se celým zněním (jako u I2b).
4. Edge funkce: `auto-reminders-job`, `export-session-*` (pokud čtou úkoly) vynechají materiál a oznámení. Pak výchozí stav upozornění u oznámení = zapnuto.

Kontroly po migraci:
- triggery existují
- pokus u `[TEST]` materiálu je odmítnut
- odevzdání po termínu bez povolení je odmítnuto, s povolením projde
- existující počty pokusů a XP se nezměnily

Rollback fáze 2:
```sql
DROP TRIGGER IF EXISTS trg_enforce_assignment_deadline ON public.assignment_attempts;
DROP FUNCTION IF EXISTS public.enforce_assignment_deadline();
DROP TRIGGER IF EXISTS trg_block_material_attempts ON public.assignment_attempts;
DROP FUNCTION IF EXISTS public.block_material_attempts();
-- + obnova původních definic funkcí z uložených rollback souborů (ověření md5)
```

## Rizika
- Místa, která počítají úkoly a nejsou ve fázi 1 ošetřená (statistiky, liga, připomínky). Do fáze 2 se materiál a oznámení mohou objevit v počtech „zadaných úkolů“. XP nevznikne, protože se nezakládá pokus.
- Kopie předmětu/třídy přenáší `settings`, takže druh i platnost zůstanou (ověřit testem).
- Uložený stav sbalení skupin: nové skupiny se zobrazí rozbalené.
- Demo a testovací žák: beze změny pravidel.

Nic se nespustí bez „schvaluji fázi 1“ / „schvaluji fázi 2“ a nic se nenasadí bez „nasadit“.
