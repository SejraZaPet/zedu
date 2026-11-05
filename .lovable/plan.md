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
