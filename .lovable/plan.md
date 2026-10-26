# Bannery pro zástupce vedení (get_my_banners) – návrh ke schválení

## Zjištěný stav (ověřeno čtením databáze)
- `school_leadership_delegates`: `id`, `school_id` (NOT NULL, FK schools ON DELETE CASCADE), `user_id` (NOT NULL), `granted_by`, `created_at`; UNIQUE (school_id, user_id). Sloupce platnosti ani stavu neexistují – odebrání zástupce = smazání řádku.
- RLS: SELECT pro členy školy / školního admina, INSERT a DELETE jen `is_school_admin_of(school_id, auth.uid())`. Žádný UPDATE.
- Existující funkce `public.is_school_leadership(_school_id, _user_id)` (SECURITY DEFINER, STABLE) = `is_school_admin_of(...)` OR řádek v delegates pro tu školu. Použije se.
- `get_my_banners()`: EXECUTE mají `authenticated` a `service_role`, `anon` ne. Toto se nemění (CREATE OR REPLACE zachová práva).
- Data: 2 zástupci, 0 bannerů s `target_leadership = true` → dnes bez viditelného dopadu.

## Jediná změna
V CTE `me` se příznak `lead` změní z „má roli school_admin“ na „má roli school_admin NEBO je vedením své školy podle profilu“. Vše ostatní (filtry, střídání platformních/školních, řazení, LIMIT 6, SECURITY DEFINER, search_path, návratový typ) zůstává doslova stejné.

## Migrace (SQL)
```sql
CREATE OR REPLACE FUNCTION public.get_my_banners()
 RETURNS SETOF banners
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT public.get_user_school_id(auth.uid()) AS school_id,
      (EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='school_admin')
        OR COALESCE(public.is_school_leadership(public.get_user_school_id(auth.uid()), auth.uid()), false)) AS lead,
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
$function$;
```

## Rollback (původní definice doslova)
```sql
CREATE OR REPLACE FUNCTION public.get_my_banners()
 RETURNS SETOF banners
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
```

## Bezpečnost
- **Cizí škola:** příznak se počítá jen pro školu z profilu uživatele (`get_user_school_id`). Zástupce jiné školy, než má v profilu, vedení nezíská. Školní bannery cizí školy filtr `b.school_id = me.school_id` dál vylučuje.
- **Vedení jiné školy:** školní banner pro vedení vidí jen při shodě školy. Platformní banner pro vedení (scope='platform') uvidí každý zástupce, stejně jako dnes každý school_admin; to je záměr platformního cílení.
- **Bez profilu/školy:** `school_id` NULL → `is_school_leadership` vrátí false → jen běžné bannery podle role.
- **Odebraný zástupce:** smazáním řádku přestane být vedením okamžitě (funkce je STABLE, bez cache). Platnost/stav v tabulce nejsou, není co obejít.
- **Zápis:** RLS na `banners`, storage politiky, demo politiky ani `BannerManager` se nemění; správu dál vidí jen school_admin. Funkce jen čte.
- **Demo:** demo účty nemají řádky v delegates; chování beze změny.

## Test (po schválení, v transakci s ROLLBACK, data označená [TEST])
V jedné transakci: založit [TEST] školy A a B, [TEST] uživatele-učitele s profilem ve škole A a řádkem v delegates pro A, a bannery: školní A pro vedení, školní B pro vedení, platformní pro vedení, školní A jen pro žáky. Nastavit `request.jwt.claims` na tohoto uživatele a ověřit výsledek `get_my_banners()`: vidí A-vedení a platformní-vedení, nevidí B-vedení ani žákovský. Pak smazat řádek delegates a ověřit, že bannery pro vedení zmizí. Vše končí ROLLBACK, nic nezůstane. Spustit lze jen nástrojem, který povolí zápis v transakci; pokud to nepůjde, ověření proběhne dotazem s reálnými (beze změny) daty a popisem výsledku.

## Dopad
- Stávající uživatelé: školní admini, učitelé a žáci dostanou totožný výsledek. Zástupci (2) navíc uvidí bannery pro vedení – dnes žádný takový banner neexistuje, takže okamžitý dopad je nulový.
- Kód aplikace, RLS, tabulky, edge funkce ani úložiště se nemění. Je to jediná změna.
