# Část I – „Prohlížíš jako Žák“ s ukázkovým žákem (diagnostika + návrh)

Nic nezměněno, žádná migrace, nic nenasazeno.

## Shrnutí pro učitelku
- Dnes režim „Prohlížíš jako Žák“ mění jen **menu a vzhled**. Přihlášená zůstáváte vy, takže všechny žákovské stránky čtou **vaše vlastní (prázdná) data** a vše, co v tomto režimu uděláte (sešit, procvičování, portfolio, odevzdání), se **uloží pod váš účet**.
- Ukázkoví žáci existují: 8 sdílených „spolužáků“ z dema. Mají vzorová data (dohromady 168 položek portfolia, 40 pokusů úkolů, XP), ale **nemají sešity ani procvičování**.
- Doporučuji: v režimu „jako Žák“ zobrazovat data **jednoho pevně určeného ukázkového žáka jen ke čtení**. Ukládání bude v tomto režimu zablokované s hláškou „Toto je náhled – změny se neukládají“. Do skutečného žáka se nikdy nic nezapíše.

## 1) Jak viewAs funguje dnes
- `src/contexts/AuthContext.tsx` ř. 189–235: `viewAsRole` v localStorage, `effectiveRole = isGlobalAdmin && viewAsRole ? viewAsRole : switchedRole`; `role` v kontextu = effectiveRole. `user`/`session` se nemění. Funguje jen pro global admin (učitelka bez role admin ho nemá).
- `src/components/ViewAsBanner.tsx` – lišta; `src/pages/Admin.tsx` – přepínač.
- Stránky čtoucí podle `user.id` / `session.user.id`:
  - Portfolio `src/pages/StudentPortfolio.tsx` ř. 31 (`loadFullPortfolio(user.id)`), 42, 100 (přidání položky pod user.id).
  - Moje úlohy `src/pages/StudentAssignments.tsx` ř. 65; přehrávač `StudentAssignmentPlayer.tsx` (zápis pokusů).
  - Sešit `src/pages/MyNotebook.tsx` ř. 78, 116, 150, 184, 354 (zápisy), 402 (do portfolia).
  - Učím se `src/pages/StudentPractice.tsx` ř. 234, 286, 320–348 (insert sezení + mastery).
  - Další: `StudentDashboard`, `StudentCalendar`, `StudentSchedule`, `StudentLeaderboard`, `StudentBooks`, `StudentTextbooks/Detail`, `StudentWorksheetView`, `StudentSubjectClass`, `StudentMethods`, hry `StudentGameJoin/Play`.
- Důsledek: čtení = data učitelky (prázdné); zápisy = pod učitelkou (RLS `auth.uid() = student_id` je povolí).

## 2) Ukázkový žák
- `demo_shared_users` (sloupce user_id, kind): 1× `seed` (a9d65ce0-…), 8× `classmate` (např. b0b6bdf8-…). `demo_pairs` (5 řádků) jsou dočasní návštěvníci – mažou se úklidem, nevhodní.
- Data classmates: portfolio 168, assignment_attempts 40, student_xp 8, notebooks 0, practice 0.
- RLS pro admina (čtení cizích dat): portfolio `is_admin()` SELECT ano; assignment_attempts ALL ano; student_practice_sessions SELECT ano; student_xp ALL ano; **notebooks / notebook_pages ne**; student_lesson_mastery 1 admin politika (ověřit typ).
- Alternativa „žák z vlastní třídy jen ke čtení“: technicky jde přes stávající `is_teacher_of_student` (portfolio), ale zobrazuje skutečné osobní údaje – doporučuji až jako druhou volbu, nikdy se zápisem.

## 3) Návrh řešení (doporučené: jen náhled)
- Nový hook `useEffectiveStudent()` → `{ studentId, isPreview }`: v režimu viewAs=user → id ukázkového žáka, `isPreview=true`; jinak `user.id`, `false`.
- Id ukázkového žáka: konstanta v kódu není vhodná; čte se z `demo_shared_users` (kind='classmate', první dle created_at) – admin čtení ověřit, případně malá definer RPC (viz níže).
- Všechny žákovské stránky nahradí `user.id` za `studentId` při čtení.
- Zápisy: centrální `assertNotPreview()` / vypnutá tlačítka + banner „Náhled – změny se neukládají“. Žádný insert/update v isPreview. Zapisovat do demo žáka nedoporučuji: rozbilo by to sdílená demo data pro návštěvníky a vyžadovalo by širší RLS.
- Zabezpečení: náhled nezvyšuje oprávnění – čtení cizích dat jde jen přes stávající admin RLS. Pokud se učitelka bez role admin má dostat k režimu, je potřeba DB změna níže (ne nyní).

### Potřebné DB změny (NESPOUŠTĚT, jen pro etapu 3)
Čtení sešitů ukázkového žáka adminem:
```sql
CREATE POLICY "Admin preview demo notebooks" ON public.notebooks
  FOR SELECT TO authenticated
  USING (public.is_admin() AND owner_id IN (SELECT user_id FROM public.demo_shared_users));
CREATE POLICY "Admin preview demo notebook pages" ON public.notebook_pages
  FOR SELECT TO authenticated
  USING (public.is_admin() AND EXISTS (SELECT 1 FROM public.notebooks n
    WHERE n.id = notebook_pages.notebook_id
      AND n.owner_id IN (SELECT user_id FROM public.demo_shared_users)));
```
Rollback:
```sql
DROP POLICY IF EXISTS "Admin preview demo notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Admin preview demo notebook pages" ON public.notebook_pages;
```
(Názvy sloupců `owner_id`/`notebook_id` před spuštěním ověřit.) Ukázkový žák navíc nemá sešit ani procvičování – naplnění vzorovými daty je samostatný krok (seed), jen po schválení.

## 4) Etapy, rizika, odhad
- **I1 Portfolio (bez DB):** hook + StudentPortfolio čte ukázkového žáka, skryté „Přidat“, náhledová lišta. Testy hooku a blokace zápisu. ~0,5 dne.
- **I2 Úlohy, dashboard Dnes, XP/žebříček, kalendář (bez DB):** čtení přes studentId, přehrávač úkolu jen ke čtení. ~1 den.
- **I3 Sešit + Učím se:** sešit vyžaduje SQL výše + vzorová data; procvičování v náhledu bez ukládání výsledku. ~1 den + schválení DB.
- **I4 (volitelně):** výběr žáka z vlastní třídy jen ke čtení.
- Rizika: zapomenutý zápis pod učitelkou (řeší centrální guard + test pro každou stránku); RLS demo_iso u cizích dat; sdílená demo data se nesmí měnit; dashboard může zobrazit data jiné třídy než učitelky; učitelka bez role admin režim nemá.

## Otázky
1. Souhlasíte s „jen náhled, nic se neukládá“?
2. Má režim mít i učitelka bez systémové role admin (vyžaduje DB změnu)?
