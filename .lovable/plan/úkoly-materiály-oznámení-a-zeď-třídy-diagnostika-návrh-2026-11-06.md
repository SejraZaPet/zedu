# Úkoly / Materiály / Oznámení a Zeď třídy (diagnostika + návrh)

## Současný stav (ověřeno)
- Učitel: `TeacherSubjectClass.tsx` ř. 1402–1416 má záložky Průběh / Úkoly (počet všech) / Výsledky. Záložka Úkoly (ř. 1756–1781): nadpis „Úkoly, materiály a oznámení“, jedno `AddAssignmentMenu`, jeden `AssignmentStatusGroups` pro všechny druhy.
- Žák: `StudentSubjectClass.tsx` ř. 662–677 záložka „Úkoly (počet úkolů)“, ř. 862 souhrnný řádek počtů, ř. 871 jeden `AssignmentStatusGroups` pro vše.
- `assignment-kind.ts` už má `assignmentKind`, `countByKind`, `kindFromParam`, `isPinned`, `announcementVisible`, `KIND_LABELS`.
- `assignments` má `class_id`, `group_id`, `teacher_id`, `status`, `settings`. Čtení žákem řeší politiky „Students can read assigned/group assignments“ + RESTRICTIVE `demo_iso`/`demo_guard_*`.
- Existuje `class_stories` (příběhy třídy pro rodiče, `ClassStoriesSection`) a messenger (`conversations`/`messages`, soukromé konverzace účastníků). Komentáře ke zdi nemá nic.

## Etapa 1 – pod-záložky (čistě frontend, bez DB)
- Uvnitř záložky Úkoly pod-záložky **Úkoly · Materiály · Oznámení** s počty; odznak u Úkolů = počet „Ke kontrole“ (učitel) / „nové, neodevzdané“ (žák), u Materiálů/Oznámení „nové“ = vytvořené po posledním otevření sekce (localStorage, jen vzhled).
- Každá sekce: vlastní tlačítko „Přidat úkol / materiál / oznámení“ (stávající `newAssignment(kind)`, ne nové menu), vlastní prázdný stav.
- `AssignmentStatusGroups` jen u Úkolů. Materiály a Oznámení = prostý seznam karet (připnutá nahoře, oznámení podle `announcementVisible`), řazení od nejnovějších.
- Pamatování: `?sekce=ukoly|materialy|oznameni` v URL, záloha v localStorage pro danou třídu/skupinu. Neplatná hodnota → Úkoly.
- Mobil: pod-záložky jako segmentový přepínač na celou šířku, 3 rovné sloupce, cíle ≥44 px, text se zkracuje, žádný vodorovný posun na 390 px.
- Hlavní záložka nově „Úkoly (n)“ = všechny druhy, aby se nic neschovalo.
- Nic se nemění na odevzdávání, termínech, stavech, oprávněních, e-mailech.

## Etapa 2 – Zeď v záložce Průběh (vyžaduje DB)
Rozvržení podle skici, barvy Bezli (primary gradient, stávající `Card`):
- Nahoře blok **Oznámení** (poslední 1–3 viditelná, připnutá první) + odkaz „všechna oznámení“ → přepne na Úkoly › Oznámení.
- Nadpis **Zeď** a feed: nové úkoly, materiály, oznámení (z `assignments`) a informační příspěvky učitele; u každého komentáře.

### Doporučení: stavět nad `assignments`, komentáře v nové tabulce
- Oznámení/úkoly/materiály už jsou v `assignments` s hotovými oprávněními a demo ochranou → feed je jen jiný pohled, nic se nezdvojuje.
- „Jen informace“ = oznámení (`kind=announcement`), které už existuje. Samostatná `wall_posts` by zdvojila oznámení a vyžadovala nová oprávnění — nedoporučuji.
- Komentáře: nová tabulka `assignment_comments`. Oprávnění dědí z `assignments`: kdo smí vidět úkol, smí vidět a psát komentáře.

### Návrh SQL (NESPOUŠTĚT, čeká na „schvaluji“)
```sql
CREATE TABLE public.assignment_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid
);
CREATE INDEX assignment_comments_assignment_created_idx
  ON public.assignment_comments (assignment_id, created_at);
CREATE INDEX assignment_comments_author_idx ON public.assignment_comments (author_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_comments TO authenticated;
GRANT ALL ON public.assignment_comments TO service_role;
ALTER TABLE public.assignment_comments ENABLE ROW LEVEL SECURITY;

-- učitel daného úkolu (vlastník / učitel třídy) = moderátor
CREATE OR REPLACE FUNCTION public.can_moderate_assignment_comments(_assignment_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM assignments a WHERE a.id = _assignment_id
    AND (a.teacher_id = _uid OR (a.class_id IS NOT NULL AND is_class_teacher(a.class_id, _uid))))
  OR is_admin(_uid)
$$;

-- čtení: jen když volající vidí úkol (vyhodnotí se pod jeho RLS na assignments)
CREATE POLICY ac_select ON public.assignment_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id));
-- psaní: jen za sebe a jen k úkolu, který vidí, a jen u zveřejněných
CREATE POLICY ac_insert ON public.assignment_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id));
-- úprava: autor vlastní text; moderátor smí jen skrýt (soft delete)
CREATE POLICY ac_update ON public.assignment_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.can_moderate_assignment_comments(assignment_id, auth.uid()))
  WITH CHECK (author_id = auth.uid() OR public.can_moderate_assignment_comments(assignment_id, auth.uid()));
-- mazání: autor své, učitel jakýkoli v úkolu
CREATE POLICY ac_delete ON public.assignment_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.can_moderate_assignment_comments(assignment_id, auth.uid()));

-- demo: stejné vzory jako jinde (RESTRICTIVE, nemění práva ne-demo uživatelů)
CREATE POLICY demo_iso ON public.assignment_comments AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT is_demo_user() OR demo_can_see_assignment(assignment_id))
  WITH CHECK (NOT is_demo_user() OR demo_can_see_assignment(assignment_id));
```
Plus trigger `BEFORE UPDATE`: `updated_at = now()`; pokud upravuje moderátor, který není autor, smí měnit jen `deleted_at/deleted_by` (text zůstane). Volitelně limit max. 30 komentářů/uživatel/hod (trigger), aby se zeď nezaspamovala. Přesné signatury `is_admin`, `is_demo_user`, `demo_can_see_assignment` ověřím před migrací.

Rollback:
```sql
DROP TABLE IF EXISTS public.assignment_comments;
DROP FUNCTION IF EXISTS public.can_moderate_assignment_comments(uuid, uuid);
```

### Moderace a zobrazení
- Žák: píše, upravuje a maže jen své. Učitel: maže/skrývá jakýkoli komentář pod svým úkolem; skrytý = „Komentář odstranil učitel“.
- Rodiče komentáře nevidí ani nepíšou (žádná politika pro roli rodič) — k rozhodnutí.
- Jména autorů přes stávající čtení profilů spolužáků (co už třída zobrazuje), nic nového se nezveřejňuje.
- Přepínač u příspěvku „Povolit komentáře“ v `settings.commentsEnabled` (výchozí: zapnuto u oznámení a materiálů, u úkolů vypnuto, aby se neprozrazovala řešení) — k rozhodnutí.
- Notifikace se nepřidávají.

## Vztah k messengeru
- Messenger = soukromé konverzace jednotlivců/skupin (`conversations`, `messages`). Zeď = veřejné vlákno pod konkrétním příspěvkem třídy, viditelné všem, kdo vidí příspěvek.
- Nepřekrývat: žádné zprávy ze zdi do messengeru a naopak; u komentáře nebude „odpovědět soukromě“. Nahlašování zpráv (`message_reports`) se nepoužije; moderace je mazání učitelem.
- `class_stories` (příběhy pro rodiče) zůstávají beze změny a na zdi se nezobrazují.

## Rizika
- Etapa 1: nízké — změna jen rozložení; riziko, že učitel nenajde starší položky → počty na pod-záložkách, výchozí sekce Úkoly.
- Etapa 2: střední — nová tabulka a oprávnění; jádro RLS dědí z `assignments`, takže nová práva k úkolům nevznikají. Riziko výkonu feedu u velkých tříd → načítat komentáře dávkově podle `assignment_id` s indexem, prvních 3 + „zobrazit další“. Riziko obsahu → limit 1000 znaků, moderace učitelem.

## Soubory
Etapa 1:
- `src/pages/TeacherSubjectClass.tsx`, `src/pages/StudentSubjectClass.tsx` (pod-záložky)
- nový `src/components/assignments/AssignmentKindTabs.tsx` (přepínač, počty, odznaky)
- `src/lib/assignment-kind.ts` (`sectionFromParam`, `filterByKind`, `sortForSection`) + testy `assignment-kind.test.ts`
- test komponenty: filtrace, správné tlačítko „Přidat …“, prázdný stav, paměť sekce, 390 px bez posunu

Etapa 2:
- migrace výše
- nový `src/components/class-wall/ClassWall.tsx`, `WallAnnouncements.tsx`, `WallPostComments.tsx`, `src/lib/class-wall.ts` (čisté skládání feedu) + testy
- vložení do záložky Průběh v obou stránkách
- `AGENTS.md`: pravidlo „komentáře jen v `assignment_comments`, oprávnění dědí z `assignments`“

## Na co se potřebuji rozhodnout
1. Schvalujete Etapu 1 (jen aplikace) k implementaci hned?
2. Zeď nad `assignments` + nová tabulka `assignment_comments` (doporučuji), nebo samostatné `wall_posts`?
3. Komentáře u úkolů: vypnuté ve výchozím stavu (doporučuji), nebo všude zapnuté?
4. Mají komentáře vidět i rodiče? (návrh: ne)
5. Smí žák svůj komentář upravit, nebo jen smazat?
6. Pamatovat sekci v URL (`?sekce=`, doporučuji – sdílitelný odkaz) i v prohlížeči?
