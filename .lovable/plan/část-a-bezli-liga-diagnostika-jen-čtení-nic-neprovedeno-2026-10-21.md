# Část A – Bezli liga: diagnostika (jen čtení, nic neprovedeno)

## 1. Co je hotové
- Žák: záložka „Liga“ v `src/pages/StudentLeaderboard.tsx:101` → `src/components/student/LeagueTab.tsx` (liga, soutěž tříd přes `school_league_week`/`class_league_week` ř. 35–36, odhlášení `set_league_opt_out` ř. 48). Na přehledu žáka (`StudentDashboard.tsx`) liga přímo vidět není – jen přes stránku žebříčku.
- Vedení školy: `src/components/school/SchoolLeagueCard.tsx` (zapnout ligu, způsob jména přezdívka/iniciála), vloženo v `SchoolAdmin.tsx:417`.
- Učitel: přepínač soutěže tříd v `src/components/teacher/LeaderboardSettingsCard.tsx:95`, vloženo v `TeacherClassDetail.tsx:669`.
- Server: `add_xp` (strop, opakování, série), `close_league_week` (uzávěr, postup/sestup, odznaky `league_gold/silver/bronze`), cron `close-league-week` neděle 22:05 a 23:05 UTC. Pravidla zrcadlí `src/lib/league-rules.ts`.

## 2. Co chybí / rozpracované
- Žádná škola ligu nemá zapnutou (0 škol, pilot Žatec `league_enabled=false`, jména `nickname`).
- Liga není vidět na přehledu žáka (žádná karta „Moje liga“).
- Skutečný týdenní uzávěr nikdy neproběhl, takže není ověřeno, že odznaky a postup fungují naostro.
- XP posílá serverově hlavně `submit-activity-response` (`index.ts:139`); zdroje v datech: activity 156, assignment 160, lesson 140, live_game 32, practice 3, legacy 12.

## 3. Proč jsou tabulky prázdné
Návrh je „živý výpočet“: aktuální týden se nepočítá z tabulek, ale z `xp_events` (`league_week_standings`). `league_weeks` je jen archiv uzavřených týdnů a `league_memberships` ukládá jen změnu ligy (výchozí je Bronz). Obojí plní pouze `close_league_week`, a ta prochází jen školy s `league_enabled=true` – žádná taková není, proto je vše 0. To je očekávané, ne chyba. Třídy: všech 21 má soutěž tříd zapnutou (výchozí), ale bez zapnuté školy se neprojeví. Zapíná vedení školy (školní admin) v `/skola`.

## 4. XP (odpovídá návrhu)
Denní strop 150 (pražský den); opakování téže věci týž den ×1 / ×0,5 / ×0,2 / ×0 (při 10 XP = 10/5/2/0); bonus za sérii k prvnímu zápisu dne +5 od 3 dnů, +10 od 7 dnů, vše v rámci stropu. Bez zpětného přepočtu (od 17. 10., 62 žáků).

## 5. Nejmenší krok pro pilot Žatec
Bez migrace, bez cronu, bez kódu: správce školy Žatec zapne v `/skola` kartu „Bezli liga“ (přepínač). Žáci hned uvidí aktuální týden v záložce Liga, první uzávěr proběhne sám v neděli večer. Doporučené doplnění později (samostatné schválení): karta ligy na přehledu žáka (jen UI). Alternativa, pokud to máte zapnout vy: jeden datový zápis `UPDATE public.schools SET league_enabled = true WHERE id = '17840203-9bd6-47fc-97c3-726c4da82667';` – rollback stejný s `false` (již archivované týdny zůstanou).

## 6. Rizika
- Soukromí: žebříček jen přes definer funkce, top 10 + vlastní pozice, jména dle nastavení školy; před zapnutím zkontrolovat na žákovském účtu, že se neukáže celé jméno.
- Opt-out: odhlášený žák se v žebříčku nezobrazí; ověřit po zapnutí.
- Demo: demo školy ligu zapnutou nemají, tak zůstávají mimo.
- Výkon: výpočet z `xp_events` pro jednu školu je malý; při mnoha školách přidat index (nyní netřeba).
- XP ze starších dnů (od 17. 10.) se do prvního týdne započítají jen za aktuální týden.

---

# Část B – Bannery na přehledech (návrh, nic neprovedeno)

## Co už existuje (ověřeno čtením)
- Bannery ani novinky na přehledu nejsou. Existují jen ruční oznámení (`notification_broadcasts`, `src/components/notifications/BroadcastHistory.tsx`) – jdou do zvonečku, ne na přehled. Obecný kolotoč `src/components/ui/carousel.tsx` existuje, ale nikde se pro bannery nepoužívá.
- Přehled žáka: `src/pages/StudentDashboard.tsx` – nadpis „Ahoj…“ ř. 115–124, pod ním `PlayerProfileWidget` ř. 126.
- Přehled učitele: `src/pages/TeacherDashboard.tsx` – `<main>` ř. 395, `TodayWidget` ř. 307.
- Přehled vedení: `src/pages/SchoolAdmin.tsx` (`/skola`) – `<main>` ř. 300, záložky ř. 389.
- Škola uživatele: `profiles.school_id` (funkce `get_user_school_id`) – **každý uživatel má nejvýš jednu školu**, takže „ve více školách“ dnes nenastane. Role: `user_roles` (`is_admin()`, `is_school_admin(uid)`), v aplikaci `useAuth().role`.
- Úložiště: veřejné `lesson-images`, `school-logos`; pro bannery navrhuji nový bucket.

## Umístění
Jedna komponenta `DashboardBanners` hned pod nadpisem: Student ř. 125 (před `PlayerProfileWidget`), Učitel na začátku obsahu `<main>` ř. 395, Vedení nad `<Tabs>` ř. 389. Skupina: `user` → žáci, `teacher`/`lektor` → učitelé, `school_admin` → vedení. Jinde (úkol, kvíz, hra, sešit) se nevkládá.

## Etapy
1. Databáze a úložiště (migrace níže + bucket `banners`, veřejný, limit 3 MB, typy jpg/png/webp/mp4 – limity souborů hlídá i formulář: obrázek 500 kB, video 3 MB a 10 s).
2. Zobrazení: RPC `get_my_banners()` vrátí až 6 banerů již prostřídaných (platforma, škola, …); komponenta s rezervovanou výškou (aspect 3:1, max 200 px, mobil cca 120 px), prolnutí 600 ms, pauza při najetí/dotyku, „×“ (localStorage `bezli.banner.dismiss.<id>` = min(nyní+7 dní, ends_at)), `prefers-reduced-motion` a `navigator.connection.saveData`/`effectiveType` → jen poster; video `autoPlay muted playsInline`, bez `controls`, `onEnded` počítá 2 průchody, IntersectionObserver + `visibilitychange` pauza; odkaz jen `https://`, `target=_blank rel="noopener noreferrer"`. Při chybě/prázdnu se nic nevykreslí (žádné místo).
3. Admin UI: platformový admin – nová sekce v `AdminDashboard` (záložky Žáci/Učitelé/Vedení + seznam školních banerů s tlačítkem „Skrýt“); školní admin – nová záložka „Bannery“ v `SchoolAdmin.tsx`. Formulář: soubor, poster (u videa povinný), ořez 3:1 (react-easy-crop nebo canvas, export WebP 1500×500), alt text, odkaz, cílení, sekundy, od/do, zapnuto. Náhled v reálné velikosti. Stavy: čeká / běží / vypršel / vypnutý / skryto správcem.

## Migrace (jen ukázka, NESPOUŠTĚT)
```sql
CREATE TABLE public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('platform','school')),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  image_path text, video_path text, poster_path text,
  alt_text text NOT NULL CHECK (length(btrim(alt_text)) BETWEEN 3 AND 200),
  link_url text CHECK (link_url IS NULL OR link_url ~ '^https://[^\s]+$'),
  target_students boolean NOT NULL DEFAULT false,
  target_teachers boolean NOT NULL DEFAULT false,
  target_leadership boolean NOT NULL DEFAULT false,
  display_seconds int NOT NULL DEFAULT 6 CHECK (display_seconds BETWEEN 3 AND 60),
  starts_at timestamptz, ends_at timestamptz,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  hidden_by_admin boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope='platform' AND school_id IS NULL) OR (scope='school' AND school_id IS NOT NULL)),
  CHECK (target_students OR target_teachers OR target_leadership),
  CHECK ((media_type='image' AND image_path IS NOT NULL)
      OR (media_type='video' AND video_path IS NOT NULL AND poster_path IS NOT NULL)),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX banners_scope_school_idx ON public.banners (scope, school_id) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY banners_admin_all ON public.banners FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY banners_school_admin_select ON public.banners FOR SELECT TO authenticated
  USING (scope='school' AND public.is_school_admin(auth.uid())
         AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY banners_school_admin_insert ON public.banners FOR INSERT TO authenticated
  WITH CHECK (scope='school' AND public.is_school_admin(auth.uid())
              AND school_id = public.get_user_school_id(auth.uid()) AND hidden_by_admin = false);
CREATE POLICY banners_school_admin_update ON public.banners FOR UPDATE TO authenticated
  USING (scope='school' AND public.is_school_admin(auth.uid())
         AND school_id = public.get_user_school_id(auth.uid()))
  WITH CHECK (scope='school' AND school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY banners_school_admin_delete ON public.banners FOR DELETE TO authenticated
  USING (scope='school' AND public.is_school_admin(auth.uid())
         AND school_id = public.get_user_school_id(auth.uid()));
-- Demo: jen čtení (doplňkově, nic neoslabuje)
CREATE POLICY demo_guard_banners_write ON public.banners AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_demo_user(auth.uid()));
CREATE POLICY demo_guard_banners_update ON public.banners AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()));
CREATE POLICY demo_guard_banners_delete ON public.banners AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()));

-- Pojistka: limit 3 aktivní na skupinu (platforma) / školu; školní admin nesmí měnit hidden_by_admin
CREATE OR REPLACE FUNCTION public.tg_banners_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT public.is_admin() THEN
    IF TG_OP='UPDATE' AND NEW.hidden_by_admin IS DISTINCT FROM OLD.hidden_by_admin THEN
      RAISE EXCEPTION 'Skrytí banneru smí měnit jen správce platformy';
    END IF;
    IF TG_OP='UPDATE' AND (NEW.scope<>OLD.scope OR NEW.school_id IS DISTINCT FROM OLD.school_id) THEN
      RAISE EXCEPTION 'Banner nelze přesunout do jiné školy';
    END IF;
  ELSIF TG_OP='UPDATE' AND OLD.scope='school' AND auth.uid() IS NOT NULL
        AND (to_jsonb(NEW) - 'hidden_by_admin' - 'updated_at') <> (to_jsonb(OLD) - 'hidden_by_admin' - 'updated_at') THEN
    RAISE EXCEPTION 'Školní banner smí správce platformy jen skrýt';
  END IF;
  NEW.updated_at := now();
  IF NEW.is_active AND (NEW.ends_at IS NULL OR NEW.ends_at > now()) THEN
    PERFORM pg_advisory_xact_lock(hashtext('banners:'||NEW.scope||':'||coalesce(NEW.school_id::text,'-')));
    IF NEW.scope='school' THEN
      SELECT count(*) INTO n FROM public.banners
       WHERE scope='school' AND school_id=NEW.school_id AND is_active AND NOT hidden_by_admin
         AND (ends_at IS NULL OR ends_at > now()) AND id <> NEW.id;
      IF n >= 3 THEN RAISE EXCEPTION 'Škola může mít nejvýš 3 aktivní bannery'; END IF;
    ELSE
      IF NEW.target_students AND (SELECT count(*) FROM public.banners WHERE scope='platform' AND is_active
           AND target_students AND (ends_at IS NULL OR ends_at>now()) AND id<>NEW.id) >= 3
        THEN RAISE EXCEPTION 'Žáci mohou mít nejvýš 3 aktivní platformové bannery'; END IF;
      IF NEW.target_teachers AND (SELECT count(*) FROM public.banners WHERE scope='platform' AND is_active
           AND target_teachers AND (ends_at IS NULL OR ends_at>now()) AND id<>NEW.id) >= 3
        THEN RAISE EXCEPTION 'Učitelé mohou mít nejvýš 3 aktivní platformové bannery'; END IF;
      IF NEW.target_leadership AND (SELECT count(*) FROM public.banners WHERE scope='platform' AND is_active
           AND target_leadership AND (ends_at IS NULL OR ends_at>now()) AND id<>NEW.id) >= 3
        THEN RAISE EXCEPTION 'Vedení může mít nejvýš 3 aktivní platformové bannery'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER banners_guard BEFORE INSERT OR UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.tg_banners_guard();

-- Čtení pro běžné uživatele jen přes RPC (tabulku přímo nečtou)
CREATE OR REPLACE FUNCTION public.get_my_banners()
RETURNS SETOF public.banners LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT public.get_user_school_id(auth.uid()) AS school_id,
      EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='school_admin') AS lead,
      EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role IN ('teacher','lektor')) AS teach,
      EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='user') AS stud
  ), live AS (
    SELECT b.*, row_number() OVER (PARTITION BY b.scope ORDER BY b.sort_order, b.created_at) rn
    FROM banners b, me
    WHERE auth.uid() IS NOT NULL AND b.is_active AND NOT b.hidden_by_admin
      AND (b.starts_at IS NULL OR b.starts_at <= now()) AND (b.ends_at IS NULL OR b.ends_at > now())
      AND (b.scope='platform' OR b.school_id = me.school_id)
      AND ((me.lead AND b.target_leadership) OR (me.teach AND b.target_teachers) OR (me.stud AND b.target_students))
  )
  SELECT id, scope, school_id, media_type, image_path, video_path, poster_path, alt_text, link_url,
         target_students, target_teachers, target_leadership, display_seconds, starts_at, ends_at,
         sort_order, is_active, hidden_by_admin, created_by, created_at, updated_at
  FROM live ORDER BY rn, (scope='school') LIMIT 6
$$;
REVOKE ALL ON FUNCTION public.get_my_banners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_banners() TO authenticated;
REVOKE ALL ON FUNCTION public.tg_banners_guard() FROM PUBLIC, anon;

-- Úložiště (bucket `banners` založen nástrojem, ne SQL): zápis do platform/* jen admin,
-- do school/<school_id>/* jen správce té školy; čtení veřejné.
CREATE POLICY banners_obj_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='banners' AND NOT public.is_demo_user(auth.uid()) AND (
    (public.is_admin() AND (storage.foldername(name))[1] IN ('platform','school'))
    OR ((storage.foldername(name))[1]='school' AND public.is_school_admin(auth.uid())
        AND (storage.foldername(name))[2] = public.get_user_school_id(auth.uid())::text)));
CREATE POLICY banners_obj_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id='banners' AND (public.is_admin()
    OR ((storage.foldername(name))[1]='school' AND public.is_school_admin(auth.uid())
        AND (storage.foldername(name))[2] = public.get_user_school_id(auth.uid())::text)));
```
Ano, migrace je potřeba (nová tabulka, funkce, pravidla). Stávající tabulky se nemění.

## Rollback (NESPOUŠTĚT)
```sql
DROP POLICY IF EXISTS banners_obj_insert ON storage.objects;
DROP POLICY IF EXISTS banners_obj_delete ON storage.objects;
DROP FUNCTION IF EXISTS public.get_my_banners();
DROP TRIGGER IF EXISTS banners_guard ON public.banners;
DROP FUNCTION IF EXISTS public.tg_banners_guard();
DROP TABLE IF EXISTS public.banners;
-- bucket `banners` smazat až po vyprázdnění: delete from storage.buckets where id='banners';
```

## Rizika a ošetření
- RLS: běžní uživatelé tabulku nečtou, jen přes `get_my_banners` (vidí jen svou skupinu a školu). Školní admin je vázán na `profiles.school_id`; kdyby se škola profilu změnila, ztratí přístup ke starým banerům – správné chování.
- Rychlost: RPC až po vykreslení přehledu; obrázky `loading="lazy"`, `decoding="async"`, video `preload="none"` a načte se až když je vidět; místo rezervované jen když RPC vrátí aspoň 1 banner (jinak 0 px, bez poskočení pod nadpisem jen při prvním výsledku – proto skeleton stejné výšky jen pokud byl banner v cache z minula).
- Velikost: limit bucketu 3 MB; formulář kontroluje typ, velikost, délku videa (`video.duration ≤ 10`) a poměr.
- Více škol: dnes nehrozí (jedna `school_id` na profil).
- Demo: zápisy zablokovány doplňkovými RESTRICTIVE pravidly, stávající `demo_iso`/`demo_guard_*` beze změny; demo účty bez školy uvidí jen platformové.
- Stávající přehledy: komponenta se jen vloží, při chybě se nevykreslí; uložené pořadí karet učitele se nemění.
- Bezpečnost odkazu: CHECK na `https://` v DB i ve formuláři.

## Testy
- Čistá funkce prostřídání (platforma/škola, max 6) a výpočet stavu (čeká/běží/vypršel/vypnutý/skryto).
- Výpočet zavření (7 dní vs. konec platnosti) a validace odkazu, sekund 3–60, velikostí.
- Komponenta: reduced-motion/saveData → poster, video bez zvuku a ovládání, zastavení po 2 průchodech.
- SQL test (`supabase/tests/banners.sql`): limit 3, školní admin nezapíše do cizí školy, admin školní banner jen skryje, demo nezapíše.

## Technické poznámky
- Nová tabulka a bucket se zapíší jako pravidlo do `AGENTS.md`.
- Každá etapa jen po zvláštním „schvaluji“; nic se nepublikuje.
