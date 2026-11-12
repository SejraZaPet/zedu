# Bezpečnostní sken – cílené zúžení pravidel (POUZE NÁVRH)

Nic se nespouští. Každá etapa čeká na výslovné „schvaluji“. Po neúspěchu migraci neopakovat. Všechny změny jsou aditivní nebo nahrazují jedno pravidlo; RESTRICTIVE `demo_iso` / `demo_guard_*` zůstávají beze změny.

## Zjištěno čtením (dnešní stav)

| Místo | Dnes platí |
|---|---|
| storage `assignment-materials` | SELECT „assignment materials readable by signed in users“ = `bucket_id='assignment-materials'` pro každého přihlášeného. INSERT/UPDATE/DELETE už jen vlastník (1. složka = auth.uid()). 29 souborů. |
| `game_players` | INSERT „Anyone can join a game“ `WITH CHECK true` pro `public`. SELECT jen vlastní řádek nebo učitel relace. RESTRICTIVE `demo_iso`. |
| `content_reviews` | SELECT „Authenticated can read reviews“ `true`. Zápis jen recenzent s vlastní kopií. 0 řádků. |
| `avatar_profiles` | SELECT `avatar_profiles_select` `true` pro authenticated. Zápis jen vlastník. 119 řádků. |

Kód:
- Soubory materiálů: cesta `path` je uložená v `assignments.materials` a `lesson_plans.materials` (JSON pole). Čte se jen přes `signedMaterialUrl` (`src/lib/assignment-materials.ts`, createSignedUrl 1 h). Používá: `AssignmentMaterialsList` (StudentAssignmentPlayer – úkoly, materiály i oznámení), `lesson-plan-student.ts`, `plan-links.ts` / `PlanLinksPanel`, `TeacherAssignments`, `TeacherLessonPlanEditor`, `AssignmentDetailDialog`, `lesson-content-materials.ts`. Listy (worksheets) v tomto bucketu nejsou, materiály s více listy se tedy netýkají.
- Připojení do hry: klient do `game_players` nikdy nezapisuje. Žák s účtem i bez účtu jde přes edge funkci `join-game`, která zapisuje servisním klíčem (RLS obchází). Čtení přes `game_players_public` a realtime.
- `content_reviews`: jen `src/lib/content-shares.ts` (hodnocení sdíleného obsahu na tržišti, napříč školami).
- `avatar_profiles`: vlastní (ProfilePage, AvatarEditor); cizí přes `ProfileAvatarBubble` v žebříčku třídy, Lize, zprávách, herním projektoru/overlay, učitelském přehledu; admin `AvatarItemsManager` (UPDATE napříč profily).

## Etapa 1 – game_players INSERT (nejnižší riziko)

(a) viz tabulka. (c) jediný zapisovatel je `join-game` se servisním klíčem → zúžení připojení nerozbije.

(b) SQL:
```sql
DROP POLICY IF EXISTS "Anyone can join a game" ON public.game_players;
CREATE POLICY "Join open session as self" ON public.game_players
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND join_token IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.game_sessions s
                WHERE s.id = game_players.session_id
                  AND s.status IN ('lobby','playing'))
  );
```
Hosté bez účtu (anon) přímo zapisovat nebudou – připojují se jen přes `join-game`, jako dnes. Před spuštěním ověřit SELECTem skutečné hodnoty `game_sessions.status` a sloupce `join_token`.

Rollback:
```sql
DROP POLICY IF EXISTS "Join open session as self" ON public.game_players;
CREATE POLICY "Anyone can join a game" ON public.game_players
  FOR INSERT TO public WITH CHECK (true);
```
(d) Riziko: nízké. Test: připojení žáka s účtem a hosta kódem hry, živá prezentace, demo hra; přímý INSERT klientem do ukončené relace musí selhat.

## Etapa 2 – soubory assignment-materials

Princip: „kdo vidí úkol / plán hodiny, vidí i jeho soubor“. Funkce běží s právy volajícího (SECURITY INVOKER), takže automaticky platí stávající RLS úkolů: třída, skupina, `assignment_recipients` (vybraní žáci), rodiče, spoluučitelé, admin, `demo_iso`. Žádná nová práva se nevytváří.

(b) SQL:
```sql
CREATE OR REPLACE FUNCTION public.can_read_assignment_material(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.assignments a
                 WHERE a.materials @> jsonb_build_array(jsonb_build_object('path', _name)))
      OR EXISTS (SELECT 1 FROM public.lesson_plans lp
                 WHERE lp.materials @> jsonb_build_array(jsonb_build_object('path', _name)));
$$;
GRANT EXECUTE ON FUNCTION public.can_read_assignment_material(text) TO authenticated;

DROP POLICY IF EXISTS "assignment materials readable by signed in users" ON storage.objects;
CREATE POLICY "assignment materials readable by owner or audience" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'assignment-materials'
    AND ( (storage.foldername(name))[1] = auth.uid()::text
          OR public.can_read_assignment_material(name) )
  );
```
Rollback:
```sql
DROP POLICY IF EXISTS "assignment materials readable by owner or audience" ON storage.objects;
CREATE POLICY "assignment materials readable by signed in users" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'assignment-materials');
DROP FUNCTION IF EXISTS public.can_read_assignment_material(text);
```
Před spuštěním (čtení): ověřit typ sloupců `materials` (jsonb) a že všech 29 souborů je odkazováno v úkolu nebo plánu; neodkázané soubory zůstanou čitelné jen vlastníkovi (sirotci, nic se nemaže).
(d) Riziko: střední – soubor vložený do úkolu jiného učitele (kopie úkolu se stejnou cestou) funguje, protože se hledá podle cesty. Riziko: materiály z lekce převzaté do plánu bez zápisu do `materials`. Test: žák ve třídě, ve skupině, vybraný a nevybraný příjemce, oznámení, materiál, plán hodiny, rodič, demo pár; učitel jiné školy musí dostat chybu.

## Etapa 3 – content_reviews SELECT

Hodnocení na tržišti jsou záměrně mezi školami, zúžení na školu by je skrylo. Návrh: číst smí recenzent, učitelé/admini (autoři a kupující obsahu), žáci ne.
```sql
DROP POLICY IF EXISTS "Authenticated can read reviews" ON public.content_reviews;
CREATE POLICY "Staff and reviewer read reviews" ON public.content_reviews
  FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() OR public.is_admin_or_teacher());
```
Rollback:
```sql
DROP POLICY IF EXISTS "Staff and reviewer read reviews" ON public.content_reviews;
CREATE POLICY "Authenticated can read reviews" ON public.content_reviews
  FOR SELECT TO authenticated USING (true);
```
(d) Riziko nízké (0 řádků). Pokud chcete opravdu jen vlastní školu, hodnocení cizích škol na tržišti zmizí – rozhodnutí na Vás.

## Etapa 4 – avatar_profiles SELECT

Avatar jiného uživatele se zobrazuje v žebříčku, Lize (přes třídy), zprávách a hrách. Návrh: vlastník, admin, stejná škola, nebo společná třída/skupina, nebo spoluhráč/učitel téže herní relace.
```sql
CREATE OR REPLACE FUNCTION public.can_see_avatar(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _owner = auth.uid() OR public.is_admin()
    OR (public.get_user_school_id(auth.uid()) IS NOT NULL
        AND public.get_user_school_id(_owner) = public.get_user_school_id(auth.uid()))
    OR EXISTS (SELECT 1 FROM class_members a JOIN class_members b ON a.class_id=b.class_id
               WHERE a.user_id=auth.uid() AND b.user_id=_owner)
    OR EXISTS (SELECT 1 FROM classes c JOIN class_members m ON m.class_id=c.id
               WHERE (c.teacher_id=auth.uid() AND m.user_id=_owner) OR (c.teacher_id=_owner AND m.user_id=auth.uid()))
    OR EXISTS (SELECT 1 FROM subject_group_members a JOIN subject_group_members b ON a.group_id=b.group_id
               WHERE a.student_id=auth.uid() AND b.student_id=_owner)
    OR EXISTS (SELECT 1 FROM game_players p JOIN game_players q ON p.session_id=q.session_id
               WHERE p.user_id=auth.uid() AND q.user_id=_owner)
    OR EXISTS (SELECT 1 FROM game_players q JOIN game_sessions s ON s.id=q.session_id
               WHERE q.user_id=_owner AND s.teacher_id=auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.can_see_avatar(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_see_avatar(uuid) TO authenticated;

DROP POLICY IF EXISTS avatar_profiles_select ON public.avatar_profiles;
CREATE POLICY avatar_profiles_select_related ON public.avatar_profiles
  FOR SELECT TO authenticated USING (public.can_see_avatar(user_id));
```
Před spuštěním ověřit přesné názvy sloupců (`class_members.user_id`, `subject_group_members.student_id`, `classes.teacher_id`, `game_sessions.teacher_id`) a jak Liga vybírá soupeře; pokud Liga ukazuje žáky z jiných škol, přidat podmínku na `league_memberships` stejného týdne.
Rollback:
```sql
DROP POLICY IF EXISTS avatar_profiles_select_related ON public.avatar_profiles;
CREATE POLICY avatar_profiles_select ON public.avatar_profiles
  FOR SELECT TO authenticated USING (true);
DROP FUNCTION IF EXISTS public.can_see_avatar(uuid);
```
(d) Riziko: nejvyšší (mnoho míst). Admin `AvatarItemsManager` funguje dál (admin). Test: žebříček třídy, Liga, zprávy, projektor hry, učitelský přehled, demo pár; žák jiné školy bez vazby avatar neuvidí (zobrazí se výchozí postavička, ne chyba).

## Etapa 5 – záměrně veřejná data (beze změny)

Ve skenu označit jako „přijaté“ s odůvodněním „veřejný obsah webu / katalog, jen čtení“: `articles`, `podcast_episodes`, `landing_sections`, `section_links`, `subjects`, `learning_methods`, `study_methods`, `marketplace_settings`, `avatar_item_base_variants`. Před označením ověřit, že u nich je veřejné jen SELECT, nikoli zápis.

## Doporučené pořadí

1 (hry) → 3 (recenze) → 2 (soubory) → 4 (avatary) → 5 (označení ve skenu). Po každé etapě SELECT kontrola počtů a ruční průchod; další etapa až po potvrzení.
