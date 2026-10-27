# Část I2b – balíček ke schválení (SQL + rollback)

Nic není spuštěno, migrace žádná a I2a také ne. Tento dokument je jen podklad ke schválení.

## Shrnutí pro učitelku
- Z žebříčků, ligy, licencí, upozornění, kontaktů ve zprávách a z hledání podle kódu se vyřadí testovací žák. Pro všechny ostatní se výsledky nezmění: dnes neexistuje žádný testovací žák (0 záznamů, 0 ve třídách).
- Když se přihlásí sám testovací žák, nic nespadne. Žebříček mu vrátí prázdný seznam a liga stav „demo“, takže se mu Liga neukáže.
- **Rozdělení kvůli délce:** úplné původní i nové znění všech funkcí by přesáhlo maximální délku jednoho plánu (50 000 znaků). Proto je balíček ve dvou částech a nic se nezkracuje:
  - **I2b-1 (tento dokument):** 14 funkcí – žebříček, liga, licence, kontakty, rozesílání, upozornění na úkoly, hledání podle kódu.
  - **I2b-2 (další dokument, připravím po vašem pokynu):** 5 delších funkcí – statistiky třídy, přehled zapojení školy, přehled školy (počty žáků u licence), upozornění na novou učebnici a příspěvky pro rodiče.

## 1) Seznam funkcí I2b-1 a změna (diff)
| # | Funkce | Co se liší |
|---|---|---|
| 1 | `class_leaderboard` | ve větvi učitele/admina navíc `AND NOT public.is_preview_student(cm.user_id)` |
| 2 | `class_leaderboard_student` | když volá testovací žák, vrátí prázdno; v členech navíc `AND NOT public.is_preview_student(cm.user_id)` |
| 3 | `reset_class_leaderboard` | testovacímu žákovi se nezakládá výchozí stav: `AND NOT public.is_preview_student(cm.user_id)` |
| 4 | `league_week_standings` | v `eligible` navíc `AND NOT public.is_preview_student(p.id)`. Tím ho automaticky nebude obsahovat ani `close_league_week` (uzavření týdne, odznaky, postupy), která se proto nemění. |
| 5 | `school_league_week` | testovací žák dostane stav `'demo'` stejně jako demo účet |
| 6 | `my_league_status` | testovacímu žákovi vrací `school_enabled = false` |
| 7 | `class_league_week` | testovacímu žákovi vrátí prázdno; ostatním se nic nemění |
| 8 | `messenger_contacts` | testovací žák se nevrací jako kontakt |
| 9 | `_resolve_broadcast_recipients` | ve všech větvích se vyřadí testovací žák. Pokrývá `send_notification` i naplánované rozesílání (`_fanout_broadcast`), ty se proto nemění. |
| 10 | `notify_on_assignment_published` | žákovské upozornění na nový úkol se testovacímu žákovi nevytvoří |
| 11 | `notify_deadline_soon` | upozornění na blížící se termín se testovacímu žákovi nevytvoří (osobní úkoly beze změny) |
| 12 | `school_license_usage` | testovací žák se nezapočítá do použitých míst |
| 13 | `school_license_usage_all` | totéž pro přehled všech škol |
| 14 | `find_student_by_code` | testovací žák se podle kódu nenajde |

**Bez změny (zkontrolováno):**
- `close_league_week`, `send_notification` a `_fanout_broadcast` čerpají z funkcí výše.
- `add_xp`, `is_teacher_of_student`, `can_*` a `_ensure_course_notebooks_for` musí pro testovacího žáka fungovat jako dřív.
- Demo funkce se nemění.

**V I2b-2:** `class_engagement_stats`, `school_engagement_overview`, `school_overview_stats`, `notify_on_class_textbook_added`, `notify_on_class_story`.

**Mimo DB (etapa I2c):** exporty, upozornění na žáky, e-maily rodičům a hry.

## 2) Kontroly provedené čtením
1. Signatury a návratové typy jsou 1:1 shodné s `pg_get_functiondef`, mění se jen tělo.
2. Nový je jen jeden odkaz, `public.is_preview_student(uuid)`. Funkce existuje (argument `_uid uuid`) a vrací boolean.
3. Všechny ostatní sloupce (`cm.user_id`, `p.id`, `p.school_id`, `p.student_code`, `x.total_xp`, `b.baseline_xp`, `ur.role`…) jsou převzaté z původních definic, žádný nový sloupec nepřibyl.
4. V `_resolve_broadcast_recipients` se pro `unnest` používá alias `u`, aby nedošlo ke kolizi s výstupní proměnnou `recipient_id`.
5. Nikde se nepoužívá `is_preview_owner` (ta vznikne až v I2a), takže I2b nezávisí na I2a.
6. Všechny funkce zůstávají `SECURITY DEFINER` se `search_path = public`. Oprávnění k EXECUTE se při `CREATE OR REPLACE` nemění.
7. Data: `preview_students` = 0 řádků, ve `class_members` 0 testovacích žáků. Výstup se tedy dnes nezmění nikomu.

## 3) Nové definice (CREATE OR REPLACE) – NESPOUŠTĚT

```sql
-- 1
CREATE OR REPLACE FUNCTION public.class_leaderboard(_class_id uuid)
 RETURNS TABLE(student_id uuid, total_xp integer, level integer, badge_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF auth.uid() IS NULL THEN RETURN; END IF;
 IF public.is_demo_user(auth.uid()) AND NOT public.demo_can_see_class(_class_id) THEN RETURN; END IF;
 IF public.is_admin() OR public.is_class_teacher(_class_id,auth.uid()) THEN
 RETURN QUERY SELECT cm.user_id,coalesce(x.total_xp,0),coalesce(x.level,1),(SELECT count(*) FROM public.student_badges b WHERE b.student_id=cm.user_id)
 FROM public.class_members cm LEFT JOIN public.student_xp x ON x.student_id=cm.user_id
 WHERE cm.class_id=_class_id AND NOT public.is_preview_student(cm.user_id) AND (NOT public.is_demo_user(auth.uid()) OR public.demo_can_see_user(cm.user_id));
 ELSE
 RETURN QUERY SELECT r.student_id,r.xp,r.level,r.badge_count FROM public.class_leaderboard_student(_class_id) r;
 END IF;
END $function$;

-- 2
CREATE OR REPLACE FUNCTION public.class_leaderboard_student(_class_id uuid)
 RETURNS TABLE(rank integer, display_name text, student_id uuid, xp integer, level integer, badge_count bigint, is_me boolean, avatar_user_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _anonymous boolean; _mode text;
BEGIN
 IF _me IS NULL OR NOT EXISTS (SELECT 1 FROM public.class_members WHERE class_id=_class_id AND user_id=_me) THEN RETURN; END IF;
 IF public.is_preview_student(_me) THEN RETURN; END IF;
 IF public.is_demo_user(_me) AND NOT public.demo_can_see_class(_class_id) THEN RETURN; END IF;
 SELECT c.leaderboard_anonymous, COALESCE(s.league_name_mode,'initial') INTO _anonymous,_mode
 FROM public.classes c LEFT JOIN public.schools s ON s.id=c.school_id WHERE c.id=_class_id AND c.leaderboard_enabled;
 IF NOT FOUND THEN RETURN; END IF;
 RETURN QUERY WITH members AS (
 SELECT cm.user_id AS sid, greatest(0,coalesce(x.total_xp,0)-coalesce(b.baseline_xp,0))::int AS points,coalesce(x.level,1) AS lvl,
 (SELECT count(*) FROM public.student_badges sb WHERE sb.student_id=cm.user_id) AS badges
 FROM public.class_members cm LEFT JOIN public.student_xp x ON x.student_id=cm.user_id
 LEFT JOIN public.class_leaderboard_baselines b ON b.class_id=cm.class_id AND b.student_id=cm.user_id
 WHERE cm.class_id=_class_id AND NOT public.is_preview_student(cm.user_id) AND (NOT public.is_demo_user(_me) OR public.demo_can_see_user(cm.user_id))
 ), ranked AS (SELECT m.*, row_number() OVER (ORDER BY m.points DESC,m.sid)::int AS pos FROM members m)
 SELECT r.pos, CASE WHEN coalesce(_anonymous,false) AND r.sid<>_me THEN 'Anonymní žák' ELSE public.league_display_name(r.sid,_mode) END,
 r.sid,r.points,r.lvl,r.badges,r.sid=_me, CASE WHEN coalesce(_anonymous,false) AND r.sid<>_me THEN NULL::uuid ELSE r.sid END
 FROM ranked r WHERE (r.pos<=10 AND r.points>0) OR r.sid=_me ORDER BY r.pos;
END $function$;

-- 3
CREATE OR REPLACE FUNCTION public.reset_class_leaderboard(_class_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (is_class_teacher(_class_id, auth.uid()) OR is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.class_leaderboard_baselines (class_id, student_id, baseline_xp)
  SELECT _class_id, cm.user_id, COALESCE(sx.total_xp, 0)
  FROM public.class_members cm
  LEFT JOIN public.student_xp sx ON sx.student_id = cm.user_id
  WHERE cm.class_id = _class_id
    AND NOT public.is_preview_student(cm.user_id)
  ON CONFLICT (class_id, student_id)
  DO UPDATE SET baseline_xp = EXCLUDED.baseline_xp, created_at = now();

  UPDATE public.classes SET leaderboard_reset_at = now() WHERE id = _class_id;
END;
$function$;

-- 4
CREATE OR REPLACE FUNCTION public.league_week_standings(_school uuid, _week date)
 RETURNS TABLE(user_id uuid, grade integer, tier smallint, group_no integer, rank integer, group_size integer, xp integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH eligible AS (
    SELECT p.id AS user_id,
      (SELECT max(c.year) FROM public.class_members cm JOIN public.classes c ON c.id = cm.class_id
        WHERE cm.user_id = p.id AND c.school_id = _school) AS grade
    FROM public.profiles p
    JOIN public.schools s ON s.id = p.school_id AND s.league_enabled
    WHERE p.school_id = _school
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'user')
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role <> 'user')
      AND NOT public.is_demo_user(p.id)
      AND NOT public.is_preview_student(p.id)
      AND NOT EXISTS (SELECT 1 FROM public.league_opt_outs o WHERE o.user_id = p.id)
  ), base AS (
    SELECT e.user_id, e.grade, COALESCE(m.tier, 0)::smallint AS tier,
      COALESCE((SELECT sum(x.amount) FROM public.xp_events x WHERE x.user_id = e.user_id
         AND x.day >= _week AND x.day < _week + 7), 0)::int AS xp,
      row_number() OVER (PARTITION BY e.grade, COALESCE(m.tier,0) ORDER BY md5(e.user_id::text || _week::text)) AS seq
    FROM eligible e LEFT JOIN public.league_memberships m ON m.user_id = e.user_id
    WHERE e.grade IS NOT NULL
  ), grouped AS (
    SELECT b.*, ((b.seq - 1) / 30)::int AS group_no FROM base b
  )
  SELECT g.user_id, g.grade, g.tier, g.group_no,
    (row_number() OVER (PARTITION BY g.grade, g.tier, g.group_no ORDER BY g.xp DESC, g.user_id))::int AS rank,
    (count(*) OVER (PARTITION BY g.grade, g.tier, g.group_no))::int AS group_size,
    g.xp
  FROM grouped g
$function$;

-- 5
CREATE OR REPLACE FUNCTION public.school_league_week()
 RETURNS TABLE(status text, rank integer, display_name text, avatar_user_id uuid, xp integer, is_me boolean, tier smallint, group_size integer, week_start date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _school uuid; _enabled boolean; _mode text; _week date := public.league_week_start();
  _g int; _t smallint; _gn int; _found boolean := false;
BEGIN
  IF _me IS NULL THEN RETURN; END IF;
  IF public.is_demo_user(_me) OR public.is_preview_student(_me) THEN RETURN QUERY SELECT 'demo'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  SELECT p.school_id, s.league_enabled, s.league_name_mode INTO _school, _enabled, _mode
    FROM public.profiles p LEFT JOIN public.schools s ON s.id = p.school_id WHERE p.id = _me;
  IF _school IS NULL OR NOT COALESCE(_enabled,false) THEN
    RETURN QUERY SELECT 'disabled'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.league_opt_outs o WHERE o.user_id = _me) THEN
    RETURN QUERY SELECT 'opted_out'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  SELECT l.grade, l.tier, l.group_no, true INTO _g, _t, _gn, _found
    FROM public.league_week_standings(_school, _week) l WHERE l.user_id = _me;
  IF NOT COALESCE(_found,false) THEN
    RETURN QUERY SELECT 'no_grade'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  RETURN QUERY
    SELECT 'ok'::text, l.rank, COALESCE(public.league_display_name(l.user_id, _mode), 'Žák'),
      l.user_id, l.xp, l.user_id = _me, l.tier, l.group_size, _week
    FROM public.league_week_standings(_school, _week) l
    WHERE l.grade = _g AND l.tier = _t AND l.group_no = _gn
      AND ((l.rank <= 10 AND l.xp > 0) OR l.user_id = _me)
    ORDER BY l.rank;
END; $function$;

-- 6
CREATE OR REPLACE FUNCTION public.my_league_status()
 RETURNS TABLE(opted_out boolean, tier smallint, school_enabled boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.league_opt_outs o WHERE o.user_id = auth.uid()),
    COALESCE((SELECT m.tier FROM public.league_memberships m WHERE m.user_id = auth.uid()), 0)::smallint,
    COALESCE((SELECT s.league_enabled FROM public.profiles p JOIN public.schools s ON s.id = p.school_id WHERE p.id = auth.uid()), false)
      AND NOT public.is_preview_student(auth.uid())
$function$;

-- 7
CREATE OR REPLACE FUNCTION public.class_league_week()
 RETURNS TABLE(rank integer, class_name text, avg_xp numeric, active_members integer, is_mine boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _school uuid; _week date := public.league_week_start();
BEGIN
  IF _me IS NULL OR public.is_demo_user(_me) OR public.is_preview_student(_me) THEN RETURN; END IF;
  SELECT p.school_id INTO _school FROM public.profiles p JOIN public.schools s ON s.id = p.school_id AND s.league_enabled WHERE p.id = _me;
  IF _school IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH st AS (SELECT * FROM public.league_week_standings(_school, _week)),
  per AS (
    SELECT c.id, c.name, round(avg(st.xp)::numeric, 1) AS avg_xp, count(*)::int AS active,
      bool_or(cm.user_id = _me) AS mine
    FROM public.classes c
    JOIN public.class_members cm ON cm.class_id = c.id
    JOIN st ON st.user_id = cm.user_id AND st.xp > 0
    WHERE c.school_id = _school AND c.league_enabled
    GROUP BY c.id, c.name
  ), ranked AS (
    SELECT (row_number() OVER (ORDER BY per.avg_xp DESC, per.name))::int AS rk, per.* FROM per
  )
  SELECT r.rk, r.name, r.avg_xp, r.active, COALESCE(r.mine, false) FROM ranked r
  WHERE r.rk <= 10 OR EXISTS (SELECT 1 FROM public.class_members m WHERE m.class_id = r.id AND m.user_id = _me)
  ORDER BY r.rk;
END; $function$;

-- 8
CREATE OR REPLACE FUNCTION public.messenger_contacts()
 RETURNS TABLE(id uuid, name text, is_teacher boolean, class_id uuid, class_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH my_classes AS (
    SELECT cm.class_id FROM public.class_members cm WHERE cm.user_id = auth.uid()
    UNION SELECT ct.class_id FROM public.class_teachers ct WHERE ct.user_id = auth.uid()
    UNION SELECT c.id FROM public.classes c WHERE c.created_by = auth.uid()
  ), people AS (
    SELECT cm.user_id AS uid, cm.class_id FROM public.class_members cm JOIN my_classes m ON m.class_id = cm.class_id
    UNION SELECT ct.user_id, ct.class_id FROM public.class_teachers ct JOIN my_classes m ON m.class_id = ct.class_id
    UNION SELECT c.created_by, c.id FROM public.classes c JOIN my_classes m ON m.class_id = c.id WHERE c.created_by IS NOT NULL
    UNION SELECT cp2.user_id, NULL::uuid FROM public.conversation_participants cp1
      JOIN public.conversation_participants cp2 ON cp2.conversation_id = cp1.conversation_id
      WHERE cp1.user_id = auth.uid()
  )
  SELECT DISTINCT p.id, trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),
    public.messenger_is_teacher(p.id), pe.class_id, c.name
  FROM people pe JOIN public.profiles p ON p.id = pe.uid
  LEFT JOIN public.classes c ON c.id = pe.class_id
  WHERE p.id <> auth.uid() AND auth.uid() IS NOT NULL
    AND NOT public.is_preview_student(p.id)
$function$;

-- 9
CREATE OR REPLACE FUNCTION public._resolve_broadcast_recipients(_b notification_broadcasts)
 RETURNS TABLE(recipient_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _b.receiver_type = 'all' THEN
    RETURN QUERY SELECT p.id FROM public.profiles p WHERE NOT public.is_preview_student(p.id);
  ELSIF _b.receiver_type = 'all_teachers' THEN
    RETURN QUERY
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('admin','teacher');
  ELSIF _b.receiver_type = 'all_students' THEN
    RETURN QUERY
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role = 'user' AND NOT public.is_preview_student(ur.user_id);
  ELSIF _b.receiver_type = 'class' THEN
    RETURN QUERY
      SELECT DISTINCT cm.user_id
      FROM public.class_members cm
      WHERE cm.class_id = ANY(_b.receiver_ids)
        AND NOT public.is_preview_student(cm.user_id);
  ELSIF _b.receiver_type IN ('user','group') THEN
    RETURN QUERY SELECT u FROM unnest(_b.receiver_ids) AS u WHERE NOT public.is_preview_student(u);
  END IF;
END;
$function$;

-- 10
CREATE OR REPLACE FUNCTION public.notify_on_assignment_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') AND NEW.class_id IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
    SELECT 
      cm.user_id,
      'assignment_new',
      'Nový úkol: ' || NEW.title,
      COALESCE(NEW.description, ''),
      jsonb_build_object('assignment_id', NEW.id, 'class_id', NEW.class_id, 'deadline', NEW.deadline),
      '/student/ulohy/' || NEW.id::text
    FROM public.class_members cm
    WHERE cm.class_id = NEW.class_id
      AND NOT public.is_preview_student(cm.user_id);
    
    INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
    SELECT 
      ct.user_id,
      'assignment_new',
      'Nový úkol ve třídě: ' || NEW.title,
      'Úkol byl publikován ve vaší třídě.',
      jsonb_build_object('assignment_id', NEW.id, 'class_id', NEW.class_id),
      '/ucitel/ulohy'
    FROM public.class_teachers ct
    WHERE ct.class_id = NEW.class_id AND ct.user_id != NEW.teacher_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- 11
CREATE OR REPLACE FUNCTION public.notify_deadline_soon()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
  SELECT DISTINCT
    cm.user_id,
    'assignment_deadline_soon',
    'Brzy končí termín úkolu',
    'Úkol „' || a.title || '" má termín do ' || to_char(a.deadline AT TIME ZONE 'Europe/Prague', 'DD.MM. HH24:MI') || '.',
    jsonb_build_object('assignment_id', a.id, 'class_id', a.class_id, 'deadline', a.deadline),
    '/student/ulohy/' || a.id::text
  FROM public.assignments a
  JOIN public.class_members cm ON cm.class_id = a.class_id
  WHERE a.status = 'published'
    AND a.deadline IS NOT NULL
    AND a.deadline > now()
    AND a.deadline <= now() + interval '24 hours'
    AND NOT public.is_preview_student(cm.user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.assignment_attempts att
      WHERE att.assignment_id = a.id
        AND att.student_id = cm.user_id
        AND att.status = 'submitted'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = cm.user_id
        AND n.type = 'assignment_deadline_soon'
        AND n.payload->>'assignment_id' = a.id::text
        AND n.created_at > now() - interval '20 hours'
    );

  -- Osobní úkoly (todos): termín zítra, nesplněné
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
  SELECT
    t.user_id,
    'todo_deadline_soon',
    'Zítra vyprší termín úkolu',
    left(t.title, 80),
    jsonb_build_object('todo_id', t.id, 'due_date', t.due_date),
    '/todo'
  FROM public.todos t
  WHERE t.due_date = CURRENT_DATE + 1
    AND t.status <> 'done'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = t.user_id
        AND n.type = 'todo_deadline_soon'
        AND n.payload->>'todo_id' = t.id::text
        AND n.created_at > now() - interval '24 hours'
    );
END;
$function$;

-- 12
CREATE OR REPLACE FUNCTION public.school_license_usage(_school_id uuid)
 RETURNS TABLE(school_id uuid, teachers_used integer, students_used integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_admin() OR public.is_school_admin_of(_school_id, auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to view license usage';
  END IF;

  RETURN QUERY
  SELECT
    _school_id,
    (SELECT COUNT(DISTINCT p.id)::int
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.school_id = _school_id
        AND p.status = 'approved'
        AND ur.role = 'teacher'),
    (SELECT COUNT(DISTINCT p.id)::int
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.school_id = _school_id
        AND p.status = 'approved'
        AND ur.role = 'user'
        AND NOT public.is_preview_student(p.id));
END;
$function$;

-- 13
CREATE OR REPLACE FUNCTION public.school_license_usage_all()
 RETURNS TABLE(school_id uuid, teachers_used integer, students_used integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.school_id,
    COUNT(DISTINCT p.id) FILTER (WHERE ur.role = 'teacher')::int,
    COUNT(DISTINCT p.id) FILTER (WHERE ur.role = 'user')::int
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.school_id IS NOT NULL
    AND p.status = 'approved'
    AND NOT public.is_preview_student(p.id)
  GROUP BY p.school_id;
$function$;

-- 14
CREATE OR REPLACE FUNCTION public.find_student_by_code(_code text)
 RETURNS TABLE(id uuid, first_name text, last_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.first_name, p.last_name
  FROM public.profiles p
  WHERE p.student_code = _code
    AND NOT public.is_preview_student(p.id)
  LIMIT 1
$function$;
```
Pozn. k č. 13: testovací žák má roli `user`, takže vyřazením celého jeho řádku se nezmění počet učitelů.

## 4) Kontrolní dotazy (jen SELECT, před a po; musí být shodné)
Spouští se přes dotaz jen ke čtení s plnými právy (funkce nevyžadují přihlášení, pokud se nekontroluje `auth.uid()`):
```sql
-- licence
SELECT * FROM public.school_license_usage_all() ORDER BY school_id;
-- liga (pro každou školu se zapnutou ligou)
SELECT s.id, count(l.*), sum(l.xp), md5(string_agg(l.user_id::text||l.rank||l.group_no, ',' ORDER BY l.user_id))
FROM public.schools s CROSS JOIN LATERAL public.league_week_standings(s.id, public.league_week_start()) l
WHERE s.league_enabled GROUP BY s.id ORDER BY s.id;
-- hledání podle kódu (počet nalezených kódů)
SELECT count(*) FROM public.profiles p WHERE p.student_code IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.find_student_by_code(p.student_code));
-- nikdo není testovací žák
SELECT count(*) FROM public.preview_students;
```
Funkce, které kontrolují přihlášeného (žebříček, kontakty, liga žáka), se ověří v prohlížeči. Učitelka si otevře žebříček třídy, žák Žatce Ligu a zprávy (kontakty) a výsledky porovná se stavem před změnou. Přístup k databázi z této práce je jen ke čtení, transakční test s rollbackem tedy spustit nejde.

## 5) Riziko, odhad, pořadí
- **Riziko:** nízké. Mění se jen podmínka WHERE nebo časný návrat a dnes neexistuje žádný testovací žák. Nejcitlivější je liga (č. 4), protože z ní čte i týdenní uzavírání. Změna jen vynechá testovací účty.
- **Odhad:** spuštění a kontroly zaberou asi 1 hodinu, pak následuje I2b-2.
- **Pořadí:** I2b-1 (lze nezávisle na I2a) → I2b-2 → I2c → I2d → I2a → I3. I2a může jít i dřív, na pořadí I2b nezáleží.

## 6) Rollback (úplné původní definice, za sebou)
```sql
CREATE OR REPLACE FUNCTION public.class_leaderboard(_class_id uuid)
 RETURNS TABLE(student_id uuid, total_xp integer, level integer, badge_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF auth.uid() IS NULL THEN RETURN; END IF;
 IF public.is_demo_user(auth.uid()) AND NOT public.demo_can_see_class(_class_id) THEN RETURN; END IF;
 IF public.is_admin() OR public.is_class_teacher(_class_id,auth.uid()) THEN
 RETURN QUERY SELECT cm.user_id,coalesce(x.total_xp,0),coalesce(x.level,1),(SELECT count(*) FROM public.student_badges b WHERE b.student_id=cm.user_id)
 FROM public.class_members cm LEFT JOIN public.student_xp x ON x.student_id=cm.user_id
 WHERE cm.class_id=_class_id AND (NOT public.is_demo_user(auth.uid()) OR public.demo_can_see_user(cm.user_id));
 ELSE
 RETURN QUERY SELECT r.student_id,r.xp,r.level,r.badge_count FROM public.class_leaderboard_student(_class_id) r;
 END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.class_leaderboard_student(_class_id uuid)
 RETURNS TABLE(rank integer, display_name text, student_id uuid, xp integer, level integer, badge_count bigint, is_me boolean, avatar_user_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _anonymous boolean; _mode text;
BEGIN
 IF _me IS NULL OR NOT EXISTS (SELECT 1 FROM public.class_members WHERE class_id=_class_id AND user_id=_me) THEN RETURN; END IF;
 IF public.is_demo_user(_me) AND NOT public.demo_can_see_class(_class_id) THEN RETURN; END IF;
 SELECT c.leaderboard_anonymous, COALESCE(s.league_name_mode,'initial') INTO _anonymous,_mode
 FROM public.classes c LEFT JOIN public.schools s ON s.id=c.school_id WHERE c.id=_class_id AND c.leaderboard_enabled;
 IF NOT FOUND THEN RETURN; END IF;
 RETURN QUERY WITH members AS (
 SELECT cm.user_id AS sid, greatest(0,coalesce(x.total_xp,0)-coalesce(b.baseline_xp,0))::int AS points,coalesce(x.level,1) AS lvl,
 (SELECT count(*) FROM public.student_badges sb WHERE sb.student_id=cm.user_id) AS badges
 FROM public.class_members cm LEFT JOIN public.student_xp x ON x.student_id=cm.user_id
 LEFT JOIN public.class_leaderboard_baselines b ON b.class_id=cm.class_id AND b.student_id=cm.user_id
 WHERE cm.class_id=_class_id AND (NOT public.is_demo_user(_me) OR public.demo_can_see_user(cm.user_id))
 ), ranked AS (SELECT m.*, row_number() OVER (ORDER BY m.points DESC,m.sid)::int AS pos FROM members m)
 SELECT r.pos, CASE WHEN coalesce(_anonymous,false) AND r.sid<>_me THEN 'Anonymní žák' ELSE public.league_display_name(r.sid,_mode) END,
 r.sid,r.points,r.lvl,r.badges,r.sid=_me, CASE WHEN coalesce(_anonymous,false) AND r.sid<>_me THEN NULL::uuid ELSE r.sid END
 FROM ranked r WHERE (r.pos<=10 AND r.points>0) OR r.sid=_me ORDER BY r.pos;
END $function$;

CREATE OR REPLACE FUNCTION public.reset_class_leaderboard(_class_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (is_class_teacher(_class_id, auth.uid()) OR is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.class_leaderboard_baselines (class_id, student_id, baseline_xp)
  SELECT _class_id, cm.user_id, COALESCE(sx.total_xp, 0)
  FROM public.class_members cm
  LEFT JOIN public.student_xp sx ON sx.student_id = cm.user_id
  WHERE cm.class_id = _class_id
  ON CONFLICT (class_id, student_id)
  DO UPDATE SET baseline_xp = EXCLUDED.baseline_xp, created_at = now();

  UPDATE public.classes SET leaderboard_reset_at = now() WHERE id = _class_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.league_week_standings(_school uuid, _week date)
 RETURNS TABLE(user_id uuid, grade integer, tier smallint, group_no integer, rank integer, group_size integer, xp integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH eligible AS (
    SELECT p.id AS user_id,
      (SELECT max(c.year) FROM public.class_members cm JOIN public.classes c ON c.id = cm.class_id
        WHERE cm.user_id = p.id AND c.school_id = _school) AS grade
    FROM public.profiles p
    JOIN public.schools s ON s.id = p.school_id AND s.league_enabled
    WHERE p.school_id = _school
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'user')
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role <> 'user')
      AND NOT public.is_demo_user(p.id)
      AND NOT EXISTS (SELECT 1 FROM public.league_opt_outs o WHERE o.user_id = p.id)
  ), base AS (
    SELECT e.user_id, e.grade, COALESCE(m.tier, 0)::smallint AS tier,
      COALESCE((SELECT sum(x.amount) FROM public.xp_events x WHERE x.user_id = e.user_id
         AND x.day >= _week AND x.day < _week + 7), 0)::int AS xp,
      row_number() OVER (PARTITION BY e.grade, COALESCE(m.tier,0) ORDER BY md5(e.user_id::text || _week::text)) AS seq
    FROM eligible e LEFT JOIN public.league_memberships m ON m.user_id = e.user_id
    WHERE e.grade IS NOT NULL
  ), grouped AS (
    SELECT b.*, ((b.seq - 1) / 30)::int AS group_no FROM base b
  )
  SELECT g.user_id, g.grade, g.tier, g.group_no,
    (row_number() OVER (PARTITION BY g.grade, g.tier, g.group_no ORDER BY g.xp DESC, g.user_id))::int AS rank,
    (count(*) OVER (PARTITION BY g.grade, g.tier, g.group_no))::int AS group_size,
    g.xp
  FROM grouped g
$function$;

CREATE OR REPLACE FUNCTION public.school_league_week()
 RETURNS TABLE(status text, rank integer, display_name text, avatar_user_id uuid, xp integer, is_me boolean, tier smallint, group_size integer, week_start date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _school uuid; _enabled boolean; _mode text; _week date := public.league_week_start();
  _g int; _t smallint; _gn int; _found boolean := false;
BEGIN
  IF _me IS NULL THEN RETURN; END IF;
  IF public.is_demo_user(_me) THEN RETURN QUERY SELECT 'demo'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  SELECT p.school_id, s.league_enabled, s.league_name_mode INTO _school, _enabled, _mode
    FROM public.profiles p LEFT JOIN public.schools s ON s.id = p.school_id WHERE p.id = _me;
  IF _school IS NULL OR NOT COALESCE(_enabled,false) THEN
    RETURN QUERY SELECT 'disabled'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.league_opt_outs o WHERE o.user_id = _me) THEN
    RETURN QUERY SELECT 'opted_out'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  SELECT l.grade, l.tier, l.group_no, true INTO _g, _t, _gn, _found
    FROM public.league_week_standings(_school, _week) l WHERE l.user_id = _me;
  IF NOT COALESCE(_found,false) THEN
    RETURN QUERY SELECT 'no_grade'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  RETURN QUERY
    SELECT 'ok'::text, l.rank, COALESCE(public.league_display_name(l.user_id, _mode), 'Žák'),
      l.user_id, l.xp, l.user_id = _me, l.tier, l.group_size, _week
    FROM public.league_week_standings(_school, _week) l
    WHERE l.grade = _g AND l.tier = _t AND l.group_no = _gn
      AND ((l.rank <= 10 AND l.xp > 0) OR l.user_id = _me)
    ORDER BY l.rank;
END; $function$;

CREATE OR REPLACE FUNCTION public.my_league_status()
 RETURNS TABLE(opted_out boolean, tier smallint, school_enabled boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.league_opt_outs o WHERE o.user_id = auth.uid()),
    COALESCE((SELECT m.tier FROM public.league_memberships m WHERE m.user_id = auth.uid()), 0)::smallint,
    COALESCE((SELECT s.league_enabled FROM public.profiles p JOIN public.schools s ON s.id = p.school_id WHERE p.id = auth.uid()), false)
$function$;

CREATE OR REPLACE FUNCTION public.class_league_week()
 RETURNS TABLE(rank integer, class_name text, avg_xp numeric, active_members integer, is_mine boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _school uuid; _week date := public.league_week_start();
BEGIN
  IF _me IS NULL OR public.is_demo_user(_me) THEN RETURN; END IF;
  SELECT p.school_id INTO _school FROM public.profiles p JOIN public.schools s ON s.id = p.school_id AND s.league_enabled WHERE p.id = _me;
  IF _school IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH st AS (SELECT * FROM public.league_week_standings(_school, _week)),
  per AS (
    SELECT c.id, c.name, round(avg(st.xp)::numeric, 1) AS avg_xp, count(*)::int AS active,
      bool_or(cm.user_id = _me) AS mine
    FROM public.classes c
    JOIN public.class_members cm ON cm.class_id = c.id
    JOIN st ON st.user_id = cm.user_id AND st.xp > 0
    WHERE c.school_id = _school AND c.league_enabled
    GROUP BY c.id, c.name
  ), ranked AS (
    SELECT (row_number() OVER (ORDER BY per.avg_xp DESC, per.name))::int AS rk, per.* FROM per
  )
  SELECT r.rk, r.name, r.avg_xp, r.active, COALESCE(r.mine, false) FROM ranked r
  WHERE r.rk <= 10 OR EXISTS (SELECT 1 FROM public.class_members m WHERE m.class_id = r.id AND m.user_id = _me)
  ORDER BY r.rk;
END; $function$;

CREATE OR REPLACE FUNCTION public.messenger_contacts()
 RETURNS TABLE(id uuid, name text, is_teacher boolean, class_id uuid, class_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH my_classes AS (
    SELECT cm.class_id FROM public.class_members cm WHERE cm.user_id = auth.uid()
    UNION SELECT ct.class_id FROM public.class_teachers ct WHERE ct.user_id = auth.uid()
    UNION SELECT c.id FROM public.classes c WHERE c.created_by = auth.uid()
  ), people AS (
    SELECT cm.user_id AS uid, cm.class_id FROM public.class_members cm JOIN my_classes m ON m.class_id = cm.class_id
    UNION SELECT ct.user_id, ct.class_id FROM public.class_teachers ct JOIN my_classes m ON m.class_id = ct.class_id
    UNION SELECT c.created_by, c.id FROM public.classes c JOIN my_classes m ON m.class_id = c.id WHERE c.created_by IS NOT NULL
    UNION SELECT cp2.user_id, NULL::uuid FROM public.conversation_participants cp1
      JOIN public.conversation_participants cp2 ON cp2.conversation_id = cp1.conversation_id
      WHERE cp1.user_id = auth.uid()
  )
  SELECT DISTINCT p.id, trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),
    public.messenger_is_teacher(p.id), pe.class_id, c.name
  FROM people pe JOIN public.profiles p ON p.id = pe.uid
  LEFT JOIN public.classes c ON c.id = pe.class_id
  WHERE p.id <> auth.uid() AND auth.uid() IS NOT NULL
$function$;

CREATE OR REPLACE FUNCTION public._resolve_broadcast_recipients(_b notification_broadcasts)
 RETURNS TABLE(recipient_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _b.receiver_type = 'all' THEN
    RETURN QUERY SELECT p.id FROM public.profiles p;
  ELSIF _b.receiver_type = 'all_teachers' THEN
    RETURN QUERY
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('admin','teacher');
  ELSIF _b.receiver_type = 'all_students' THEN
    RETURN QUERY
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role = 'user';
  ELSIF _b.receiver_type = 'class' THEN
    RETURN QUERY
      SELECT DISTINCT cm.user_id
      FROM public.class_members cm
      WHERE cm.class_id = ANY(_b.receiver_ids);
  ELSIF _b.receiver_type IN ('user','group') THEN
    RETURN QUERY SELECT unnest(_b.receiver_ids);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_assignment_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') AND NEW.class_id IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
    SELECT 
      cm.user_id,
      'assignment_new',
      'Nový úkol: ' || NEW.title,
      COALESCE(NEW.description, ''),
      jsonb_build_object('assignment_id', NEW.id, 'class_id', NEW.class_id, 'deadline', NEW.deadline),
      '/student/ulohy/' || NEW.id::text
    FROM public.class_members cm
    WHERE cm.class_id = NEW.class_id;
    
    INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
    SELECT 
      ct.user_id,
      'assignment_new',
      'Nový úkol ve třídě: ' || NEW.title,
      'Úkol byl publikován ve vaší třídě.',
      jsonb_build_object('assignment_id', NEW.id, 'class_id', NEW.class_id),
      '/ucitel/ulohy'
    FROM public.class_teachers ct
    WHERE ct.class_id = NEW.class_id AND ct.user_id != NEW.teacher_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_deadline_soon()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
  SELECT DISTINCT
    cm.user_id,
    'assignment_deadline_soon',
    'Brzy končí termín úkolu',
    'Úkol „' || a.title || '" má termín do ' || to_char(a.deadline AT TIME ZONE 'Europe/Prague', 'DD.MM. HH24:MI') || '.',
    jsonb_build_object('assignment_id', a.id, 'class_id', a.class_id, 'deadline', a.deadline),
    '/student/ulohy/' || a.id::text
  FROM public.assignments a
  JOIN public.class_members cm ON cm.class_id = a.class_id
  WHERE a.status = 'published'
    AND a.deadline IS NOT NULL
    AND a.deadline > now()
    AND a.deadline <= now() + interval '24 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.assignment_attempts att
      WHERE att.assignment_id = a.id
        AND att.student_id = cm.user_id
        AND att.status = 'submitted'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = cm.user_id
        AND n.type = 'assignment_deadline_soon'
        AND n.payload->>'assignment_id' = a.id::text
        AND n.created_at > now() - interval '20 hours'
    );

  -- Osobní úkoly (todos): termín zítra, nesplněné
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
  SELECT
    t.user_id,
    'todo_deadline_soon',
    'Zítra vyprší termín úkolu',
    left(t.title, 80),
    jsonb_build_object('todo_id', t.id, 'due_date', t.due_date),
    '/todo'
  FROM public.todos t
  WHERE t.due_date = CURRENT_DATE + 1
    AND t.status <> 'done'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = t.user_id
        AND n.type = 'todo_deadline_soon'
        AND n.payload->>'todo_id' = t.id::text
        AND n.created_at > now() - interval '24 hours'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.school_license_usage(_school_id uuid)
 RETURNS TABLE(school_id uuid, teachers_used integer, students_used integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_admin() OR public.is_school_admin_of(_school_id, auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to view license usage';
  END IF;

  RETURN QUERY
  SELECT
    _school_id,
    (SELECT COUNT(DISTINCT p.id)::int
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.school_id = _school_id
        AND p.status = 'approved'
        AND ur.role = 'teacher'),
    (SELECT COUNT(DISTINCT p.id)::int
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.school_id = _school_id
        AND p.status = 'approved'
        AND ur.role = 'user');
END;
$function$;

CREATE OR REPLACE FUNCTION public.school_license_usage_all()
 RETURNS TABLE(school_id uuid, teachers_used integer, students_used integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.school_id,
    COUNT(DISTINCT p.id) FILTER (WHERE ur.role = 'teacher')::int,
    COUNT(DISTINCT p.id) FILTER (WHERE ur.role = 'user')::int
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.school_id IS NOT NULL
    AND p.status = 'approved'
  GROUP BY p.school_id;
$function$;

CREATE OR REPLACE FUNCTION public.find_student_by_code(_code text)
 RETURNS TABLE(id uuid, first_name text, last_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.first_name, p.last_name
  FROM public.profiles p
  WHERE p.student_code = _code
  LIMIT 1
$function$;
```
