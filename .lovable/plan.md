# Počítadlo „nového" v Moje předměty – analýza a návrh

Nic neimplementováno, žádné SQL neaplikováno, nic nenasazeno.

## 1. Odkud se data berou dnes (ověřeno)
Zeď, materiály, úkoly i testy jsou **jediná tabulka `assignments`**. Druh se pozná z `settings.kind` (`task` / `material` / `announcement`) přes `assignment-kind.ts`. Příspěvky učitele na zdi se pozná přes `isWallPost` v `wall-composer`. Test je úkol s vyplněným `exam_type`.
- Stránka `StudentSubjectClass.tsx` načte `assignments` s `status='published'` podle `class_id` nebo `group_id`. Filtr předmětu je `subject_id = X OR subject_id IS NULL`, takže starší úkoly bez předmětu se ukážou ve všech předmětech třídy.
- Data: `created_at`, `updated_at`, `scheduled_publish_at` (u naplánovaných úkolů je skutečné zveřejnění právě `scheduled_publish_at`). Sloupec „zveřejněno v" neexistuje.
- RLS pro čtení žákem (stačí jedna povolující politika): „Students can read assigned assignments" (published + člen `class_members`), „Students can read group assignments" (published + člen `subject_group_members`). Navíc platí omezující `recipients_only` (vybraní žáci) a `demo_iso`.
- Komentáře na zdi jsou v `assignment_comments` (`created_at`, `deleted_at`). Čtení dědí viditelnost úkolu. Komentáře spolužáků **nepočítám** jako „nové od učitele".
- `class_stories` (`class_id`, `created_at`) je rodičovský příběh třídy, ne zeď předmětu. Nepočítat.

## 2. Existující záznam „už viděno" (ověřeno)
- Žádné `last_seen`/`viewed_at` pro předmět ani úkol neexistuje.
- `notifications` mají `read_at`, `type`, `link` a RLS „jen vlastní" (čtení i úprava). Typ `assignment_new` vzniká (2201 řádků, přečteno 559). Vzniká jen podle nastavení oznámení úkolu, čtení se nastaví až kliknutím na zvonek. Pro materiály a zeď spolehlivé oznámení **nevzniká** a vazba na předmět je jen v `link`.
- `localStorage` dnes ukládá sbalení skupin (`assignment-groups:student:*`), ne návštěvy.

## 3. Varianty výpočtu „nové"
„Nové" = položka viditelná žákovi, s okamžikem zveřejnění (`coalesce(scheduled_publish_at, created_at)`) po poslední návštěvě. První návštěva bez záznamu: počítat jen posledních 14 dní, ať se nezobrazí stovky.
- **A – `localStorage`** (bez DB): klíč `subject-seen:v1:<userId>:<class|group>:<subjectKey>:<kind>` = ISO čas. Rychlé a bez osobních dat na serveru. Ale na telefonu i počítači se čísla ukážou dvakrát, po smazání prohlížeče znovu a sdílený školní počítač je odliší jen podle `userId`.
- **B – tabulka `student_subject_visits`**: synchronizace mezi zařízeními, minimum dat (ID žáka, jednotka, předmět, druh, čas). Vyžaduje schválené SQL.
- **C – notifikace**: nepokrývá materiály/zeď, závisí na nastavení učitele, míchá „přečteno ve zvonku" s „viděno v předmětu". Nedoporučuji.

**Doporučení: B**, s A jako okamžitým krokem 1, který se později jen přepne (stejné rozhraní `getSeen/markSeen`). Žáci střídají telefon a počítač, proto by A dlouhodobě mátla. B ukládá jen časové razítko vlastní návštěvy, nic o obsahu.

## 4. Vzhled a vynulování
- Dlaždice „Moje předměty": bílé kolečko jako u Úloh se součtem, strop „99+", `aria-label` „Moje předměty, 5 nových".
- Karta předmětu: štítky s ikonou a číslem – zeď (MessageSquare), materiál (Book), úkol (SquareCheckBig), test (Flag). Zobrazit jen nenulové, `aria-label` „3 nové úkoly". Neopírat se jen o barvu (ikona + text).
- Vynulování po záložce: otevření záložky Zeď / Materiály / Úkoly nastaví čas daného druhu. Test se nuluje se záložkou Úkoly. Pouhé otevření předmětu nuluje jen aktuální výchozí záložku.
- Bez N+1: dnešní `loadStudentSubjects` už načítá úkoly souhrnně. Rozšíří se o `settings`, `exam_type`, `scheduled_publish_at`, `created_at` jedním dotazem pro všechny třídy/skupiny a výpočet proběhne v klientu (čistá funkce `subject-news.ts`). U A **není nutná RPC**. U B stačí jeden `select` vlastních řádků. RPC je volitelná, jen pro výkon při velkém objemu.

## 5. Nároky
- Výkon: jeden dotaz na úkoly omezený na posledních 60 dní a sloupce. Jeden dotaz na návštěvy (B). Výpočet O(n) mapou.
- Přístupnost: WCAG 2.2 AA, živá oblast se nevyhlašuje při načtení, štítky min. 24 px s textem.
- Mobil: štítky se zalamují, bez horizontálního posunu při 360 px.
- Demo: A nezapisuje do DB. U B musí tabulka mít `demo_guard`/`demo_iso` restriktivní politiky jako ostatní (demo žák smí jen vlastní řádek ve svém páru), jinak zápis zakázat.

## 6. Pořadí práce
1. **Hned bez DB (A):** `subject-news.ts` + testy (filtr druhu, zveřejnění, okno 14 dní, recipients přes RLS), štítky na kartách, součet na dlaždici, `markSeen` při otevření záložky.
2. **Návrh SQL (jen soubor) `supabase/proposals/student_subject_visits.sql`:**
```sql
CREATE TABLE public.student_subject_visits (
  student_id uuid NOT NULL,
  class_id uuid, group_id uuid,
  subject_key text NOT NULL,           -- subject_id nebo název u starých slotů
  kind text NOT NULL CHECK (kind IN ('announcement','material','task','test')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((class_id IS NULL) <> (group_id IS NULL))
);
CREATE UNIQUE INDEX ssv_unique ON public.student_subject_visits
  (student_id, coalesce(class_id, group_id), subject_key, kind);
GRANT SELECT, INSERT, UPDATE ON public.student_subject_visits TO authenticated;
GRANT ALL ON public.student_subject_visits TO service_role;
ALTER TABLE public.student_subject_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY ssv_own ON public.student_subject_visits FOR ALL TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY demo_iso ON public.student_subject_visits AS RESTRICTIVE FOR ALL TO authenticated
  USING ((NOT is_demo_user(auth.uid())) OR demo_can_see_user(student_id))
  WITH CHECK ((NOT is_demo_user(auth.uid())) OR demo_can_see_user(student_id));
```
   Plus doplnit tabulku do `demo_purge_pair` a mazání při odchodu z třídy (samostatně, po schválení).
3. **Po schválení B:** přepnout úložiště, jednorázově převést hodnoty z `localStorage` (vzít novější).

## Otázky pro Tynu
1. Počítat jen příspěvky učitele na zdi, ne komentáře spolužáků? (ano/ne)
2. Starší úkoly bez předmětu počítat ve všech předmětech třídy, jak se dnes zobrazují? (ano/ne)
3. Při první návštěvě ukázat jen novinky za posledních 14 dní? (ano/ne)
4. Začít hned variantou A a B schválit později? (ano/ne)
5. Upravený (aktualizovaný) úkol znovu označit jako nový? (navrhuji ne)
