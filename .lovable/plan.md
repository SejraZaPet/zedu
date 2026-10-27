# Část I2 – skrytí testovacího žáka (diagnostika + návrh)

Jen návrh. Nic není spuštěno, žádná migrace, nic nenasazeno. Každá etapa níže se spustí až po „schvaluji“ k jejímu SQL a rollbacku.

## Shrnutí pro učitelku
- Testovací žák se může objevit na čtyřech druzích míst. Jsou to seznamy žáků tříd a skupin, výpočty v databázi (žebříčky, liga, statistiky, licence, rozesílání upozornění), serverové funkce (exporty, upozornění na žáky, e-maily rodičům, hry) a několik míst přímo v aplikaci.
- Nejbezpečnější řešení je **skrýt testovacího žáka přímo v databázi**. Seznamy žáků tříd, skupin a profilů ho neukážou nikomu kromě něj samého. Tím se během jednoho kroku zakryje 34 + 21 míst v aplikaci bez úprav kódu.
- Testovací žák bude dál normálně vidět svoje učebnice, úkoly, rozvrh, hry a sešity. Oprávnění, která to umožňují, totiž počítají s jeho členstvím ve třídě na pozadí a zůstanou beze změny.
- E-maily, notifikace a licence: testovací žák bude vyřazen z rozesílání i z počtů. E-maily na jeho falešnou adresu se navíc zablokují pojistkou přímo v odesílání.

## 1) Kde se čtou žáci a jak je filtrovat

### A. Tabulky (RLS) – zakryjí klient
| Místo | Kdo čte | Filtr | Riziko |
|---|---|---|---|
| `class_members` | 34 souborů klienta (TeacherClassDetail, ClassMembersDialog, ClassesManager, TeacherResults, AssignmentResultsDashboard, PeopleTools – losování, TeamSetup, NotificationComposer, StudentLeaderboard, widgety rodičů…) | RESTRICTIVE SELECT `NOT is_preview_student(user_id) OR user_id = auth.uid()` | nízké. Funkce SECURITY DEFINER (`is_teacher_of_student`, `can_student_view_*`, `_ensure_course_notebooks_for`, `is_class_linked_textbook`, `can_view_lesson_placement`) RLS obcházejí, takže přístup žáka zůstane. |
| `subject_group_members` | 21 souborů klienta | stejný filtr | nízké, stejné jako výše |
| `profiles` | admin správa uživatelů, školní admin, hledání žáků, rodiče | RESTRICTIVE SELECT `NOT is_preview_student(id) OR id = auth.uid() OR is_preview_owner(id)` | střední. Ověřit správu uživatelů a `find_student_by_code`, které je definer a filtr dostane zvlášť. |

Pro zápis (`INSERT/UPDATE/DELETE`) se politiky nemění.

### B. DB funkce (SECURITY DEFINER obchází RLS) – CREATE OR REPLACE s filtrem
| Funkce | Kam přidat filtr | Riziko |
|---|---|---|
| `class_leaderboard`, `class_leaderboard_student`, `reset_class_leaderboard` | `AND NOT is_preview_student(cm.user_id)` | nízké |
| `class_league_week`, `league_week_standings`, `close_league_week`, `my_league_status` | vyřadit z členství a pořadí ligy (u testovacího žáka vrátit status `demo`, takže se mu liga nezobrazí) | střední, týká se ligy |
| `class_engagement_stats`, `school_engagement_overview` | filtr na členy | nízké |
| `messenger_contacts` | nevracet testovacího žáka jako kontakt | nízké |
| `_resolve_broadcast_recipients`, `send_notification`, `notify_on_assignment_published`, `notify_deadline_soon`, `notify_on_class_story`, `notify_on_class_textbook_added` | vyřadit z příjemců | nízké. Upozornění na nový úkol testovací žák nedostane, úkol ale uvidí. |
| `school_license_usage`, `school_license_usage_all` | `AND NOT is_preview_student(p.id)` | nízké |
| `find_student_by_code` | nevracet testovacího žáka | nízké |
| beze změny: `add_xp`, `sync_avatar_unlocks`, `join_class_by_code`, `is_teacher_of_student`, `can_*`, `_ensure_course_notebooks_for`, demo funkce | – | XP a sešity mají fungovat jako u žáka |

### C. Serverové funkce
- `detect-student-alerts`, `notify-parent`, `_shared/reminder-targets.ts`: přeskočit testovacího žáka.
- `export-session-csv`, `export-session-report`: vynechat jeho řádky.
- `send-email`, `notify-email`, `send-push`: pojistka nikdy neposílat na `@preview.invalid` ani testovacímu žákovi.
- `join-game`, `submit-answer`, `submit-activity-response`, `_shared/game-scoring-apply.ts`: hrát smí. Do výsledků her se testovací žák dostane jen jako jeden z hráčů živé hry, kterou spustí sama učitelka; v lobby i výsledcích bude označen jako „Testovací žák“. Bodování se nemění.
- `create-school-user`, `_shared/ensure-class.ts`, `seed-test-accounts`, demo: beze změny.

### D. Klient
- Po etapě A zbývá málo. Do `src/lib/preview-students.ts` přijde `excludePreviewStudents(ids)` přes RPC `my_preview_student_ids()` jen pro hráče živých her (`game_players` v lobby a ve výsledcích) a pro exporty skládané v prohlížeči.
- RPC `my_preview_student_ids()` je potřeba jen tady. Vrací ID testovacích žáků, které volající smí znát, tedy jen vlastního.

## 2) SQL (NESPOUŠTĚT)

### Etapa I2a – RLS (rollback krátký)
```sql
CREATE OR REPLACE FUNCTION public.is_preview_owner(_student uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.preview_students WHERE student_id = _student AND owner_id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.is_preview_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_preview_owner(uuid) TO authenticated, service_role;

CREATE POLICY preview_hide_class_members ON public.class_members AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (NOT public.is_preview_student(user_id) OR user_id = auth.uid());
CREATE POLICY preview_hide_group_members ON public.subject_group_members AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (NOT public.is_preview_student(user_id) OR user_id = auth.uid());
CREATE POLICY preview_hide_profiles ON public.profiles AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (NOT public.is_preview_student(id) OR id = auth.uid() OR public.is_preview_owner(id));

CREATE OR REPLACE FUNCTION public.my_preview_student_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT student_id FROM public.preview_students WHERE owner_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.my_preview_student_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_preview_student_ids() TO authenticated;
```
Rollback I2a:
```sql
DROP POLICY IF EXISTS preview_hide_class_members ON public.class_members;
DROP POLICY IF EXISTS preview_hide_group_members ON public.subject_group_members;
DROP POLICY IF EXISTS preview_hide_profiles ON public.profiles;
DROP FUNCTION IF EXISTS public.my_preview_student_ids();
DROP FUNCTION IF EXISTS public.is_preview_owner(uuid);
```
Dokud neexistuje žádný testovací žák ve třídě, nemá I2a na nikoho žádný viditelný dopad.

### Etapa I2b – DB funkce
Úplné původní definice 20 funkcí mají dohromady asi 40 kB. Vytáhnu je těsně před spuštěním (`pg_get_functiondef`) do souboru rollbacku a ukážu vám je spolu s novými definicemi. Mění se vždy jen podmínka WHERE, dva příklady:

Licence – `school_license_usage_all`, původně:
```sql
  SELECT p.school_id,
    COUNT(DISTINCT p.id) FILTER (WHERE ur.role = 'teacher')::int,
    COUNT(DISTINCT p.id) FILTER (WHERE ur.role = 'user')::int
  FROM public.profiles p JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.school_id IS NOT NULL AND p.status = 'approved'
  GROUP BY p.school_id;
```
nově navíc: `AND NOT public.is_preview_student(p.id)`. Totéž platí v obou poddotazech `school_license_usage`.

Žebříček – `class_leaderboard`, původní větev učitele:
```sql
 WHERE cm.class_id=_class_id AND (NOT public.is_demo_user(auth.uid()) OR public.demo_can_see_user(cm.user_id));
```
nově: `WHERE cm.class_id=_class_id AND NOT public.is_preview_student(cm.user_id) AND (…beze změny…)`.

Rozesílání – `_resolve_broadcast_recipients`: každá větev dostane `AND NOT public.is_preview_student(<id>)`, větev `all` pak `WHERE NOT public.is_preview_student(p.id)`.

Rollback I2b: znovu spustit uložené původní definice (`CREATE OR REPLACE` 1:1).

### Etapa I2c – serverové funkce a pojistka e-mailů (bez DB)
Načtení `preview_students` přes service role a vynechání ID; `send-email` odmítne adresy `@preview.invalid`. Rollback: vrátit soubory.

### Etapa I2d – klient (bez DB)
`excludePreviewStudents()` v lobby/výsledcích živé hry a v exportech v prohlížeči.

## 3) Etapy, riziko, testy
| Etapa | Riziko | Odhad | Test |
|---|---|---|---|
| I2a RLS | nízké–střední | 0,5 d | SQL kontrola politik; Playwright: učitel otevře třídu, losování a výsledky. Testovací žák (po I3) vidí učebnice, úkoly, rozvrh a sešit; admin správa uživatelů ho neukazuje. |
| I2b funkce | střední (liga, notifikace) | 1 d | před/po porovnání výstupů žebříčku, ligy, licencí a engagementu pro třídu bez testovacího žáka (musí být shodné); vitest na `league-rules` beze změny |
| I2c server | nízké | 0,5 d | Deno testy: filtr ID, blokace `@preview.invalid` |
| I2d klient | nízké | 0,25 d | vitest `excludePreviewStudents` |
| I3 zařazení + průchod | – | 0,5–1 d | ruční scénáře všech žákovských stránek |

Pořadí: I2a → I2b → I2c → I2d → teprve potom I3. Testovací žák se do tříd přidá až po dokončení všech skrytí.

Ověření: přístup k databázi z této práce je jen ke čtení, transakční SQL testy s rollbackem tedy spustit nejde. Ověřím to dotazy jen ke čtení a v prohlížeči.
