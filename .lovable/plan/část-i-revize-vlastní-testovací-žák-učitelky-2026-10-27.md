# Část I (revize) – vlastní testovací žák učitelky

Jen návrh. Nic není změněno, žádná migrace, nic nenasazeno. Etapa I1 z minula (portfolio ukázkového žáka jen ke čtení) se po schválení nahradí tímto řešením.

## Shrnutí pro učitelku
- Každá učitelka (a admin) dostane **jednoho vlastního testovacího žáka**. Není to skutečná osoba, nemá e-mail ani heslo a přihlásit se za něj jde jen tlačítkem „Prohlížet jako žák“.
- Po přepnutí jste opravdu přihlášená jako tento žák. Funguje všechno: úkoly, Učím se, sešit, portfolio, XP, hry i kalendář. Nic se neukládá pod vás, do demo žáků ani do skutečných žáků.
- Testovací žák může být ve vašich třídách, aby viděl vaše učebnice, úkoly a rozvrh. **Nikde ho ale neuvidíte jako žáka třídy**: v seznamech, výsledcích, losování, žebříčku, exportech, statistikách ani v počtu licencí.
- Tlačítko „Zpět na učitele“ vás vrátí do vlastního účtu.
- Doporučuji **variantu A**. Skoro všechna oprávnění v ní zůstanou beze změny.

## 1) Současný stav
- **Vytváření žáků:** `supabase/functions/create-school-user/index.ts` (jen školní admin) a `create-user`, `seed-test-accounts`. Vznikne auth.users, pak `profiles` (`student_code`, `school_id`, `status`), dále `user_roles` (role `user`) a `class_members (class_id, user_id)` (ř. 267). Skupiny používají `subject_group_members`.
- **Mechanismus k převzetí:** `supabase/functions/demo-switch/index.ts` a `_shared/demo.ts` `issueSession()` (ř. 49–63). Relaci vydají na serveru bez hesla a bez e-mailu (`admin.generateLink` → `verifyOtp`). Klient pak zavolá `supabase.auth.setSession`. Totéž použije nová funkce, bez nových secrets: service role i anon klíč už v edge funkcích jsou.
- `demo_pairs` / `demo_shared_users` se nepoužijí. Patří návštěvníkům dema a čistí je úklid.

## 2) Co testovací žák potřebuje a kde ho skrýt
**Obsah účtu:** profil se `status='approved'` a `school_id` učitelky, role `user` a vlastní záznam `preview_students` (viz SQL). Volitelně se zařadí do vybraných tříd/skupin učitelky (`class_members` / `subject_group_members`). Uvidí tak úkoly, učebnice, rozvrh, hry i notebooky přesně jako žák.

**Kde se čtou žáci třídy a kde je třeba filtr `NOT is_preview_student(user_id)`:**
- DB funkce: `class_leaderboard`, `class_leaderboard_student`, `class_league_week`, `league_week_standings`, `reset_class_leaderboard`, `class_engagement_stats`, `school_engagement_overview`, `messenger_contacts`, `_resolve_broadcast_recipients`, `send_notification`, `notify_on_assignment_published`, `notify_deadline_soon`, `notify_on_class_story`, `notify_on_class_textbook_added`. Filtr se přidá do výběru členů. `is_teacher_of_student`, `can_student_view_*` a `_ensure_course_notebooks_for` zůstanou beze změny, protože testovací žák má mít stejná práva jako žák.
- Klient (34 souborů s `class_members`, 21 se `subject_group_members`): hlavně `TeacherClassDetail`, `ClassMembersDialog`, `ClassesManager`, `TeacherResults`, `AssignmentResultsDashboard`, `AssignmentDetailDialog`, `ClassResultsManager`, `TeacherAssignments`, `TeacherSubjectClass`, `TeacherSubjectGroups`, `PeopleTools` (losování), `TeamSetup` (hry), `NotificationComposer`, `StudentLeaderboard`, `assignment-difficulty.ts`, `import-classes.ts` a widgety pro rodiče. Řešení: jeden helper `excludePreviewStudents()`. Ten odfiltruje ID ze seznamu, který vrací RPC `my_preview_student_ids()`, případně přes view.
- Exporty (`export-session-csv`, `export-session-report`) a `detect-student-alerts`, `notify-parent`, živé hry (`game_players`): pouze filtr v edge funkcích, bez změny bodování.
- Počty licencí: všude, kde se počítají žáci školy vůči `school_licenses.seats_students`, vyloučit `preview_students`.

## 3) Licence a GDPR
- Testovací žák se nezapočítává do `seats_students` ani do statistik školy.
- Nejde o osobu. Jméno je pevné „Testovací žák (jméno učitelky)“, nemá e-mail ani rodiče a nikdy nedostane notifikace ani e-maily. Na data se GDPR nevztahuje. Při smazání učitelky se smaže kaskádou přes `delete-user`.

## 4) Bezpečnost přepnutí
- Relaci vydá jen edge funkce `preview-student-switch`. Volající musí mít roli admin, teacher nebo lektor a cíl musí být jeho vlastní testovací žák (`preview_students.owner_id = auth.uid()`). Jiné ID se nikdy nepřijímá z klienta.
- Funkce nefunguje pro demo účty (`is_demo_user`) a na demo páry.
- Testovací žák nemůže vydat relaci nikomu jinému. Návrat se dělá obnovením uložené relace učitelky v prohlížeči (refresh token v `sessionStorage`, jen pro tuto záložku). Když token vyprší, následuje nové přihlášení.
- Každé přepnutí se zapíše do `audit_log`.
- Testovací žák nemá heslo. Když se pokusí přihlásit, `login_attempts` ani `lookup-username` ho nenajdou. Musí být vyloučen v `lookup-username`.
- Riziko: učitelka zapomene, že je „žák“. Řeší to trvalá lišta „Jste testovací žák – Zpět na učitele“.

## 5) Doporučení: varianta A
Varianta B by znamenala změnit RLS na desítkách tabulek (portfolio, sešity, pokusy, procvičování, XP přes `add_xp`, hry s `join_token`). Hrozí tam únik práv a porušení serverového bodování. Varianta A mění jen čtení seznamů.

### Etapy a odhad
- **I1 (cca 1 den, migrace + edge funkce):** tabulka `preview_students` + `is_preview_student()` + RPC `ensure_my_preview_student()`. Dále funkce `preview-student-switch`, přepínač ve ViewAsBanner/menu, uložení a obnova relace, lišta, audit. Teprve potom vrátit portfolio z I1 na běžné `user.id`.
- **I2 (cca 1,5 dne, migrace funkcí + klient):** filtr ve všech DB funkcích a klientských seznamech výše, v exportech, alertech a licencích. Test pro každý seznam.
- **I3 (cca 0,5–1 den):** volba „Zařadit testovacího žáka do třídy/skupiny“ a ruční průchod všemi žákovskými stránkami (úkol, Učím se, sešit, portfolio, XP, hra, kalendář) v Chromiu.
- Rizika: zapomenutý seznam, kde se testovací žák objeví (zmírní centrální helper a testy); XP z testovacího žáka v lize (filtrováno v league funkcích); záměna relací ve více záložkách.

## SQL (NESPOUŠTĚT – etapa I1)
```sql
CREATE TABLE public.preview_students (
  student_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.preview_students TO authenticated;
GRANT ALL ON public.preview_students TO service_role;
ALTER TABLE public.preview_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own preview student" ON public.preview_students
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR student_id = auth.uid());
CREATE POLICY demo_guard_preview_students ON public.preview_students AS RESTRICTIVE
  FOR ALL TO authenticated USING (NOT public.is_demo_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_preview_student(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.preview_students WHERE student_id = _uid)
$$;
REVOKE EXECUTE ON FUNCTION public.is_preview_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_preview_student(uuid) TO authenticated, service_role;
```
Zápis do `preview_students` dělá pouze edge funkce (service role). Klient nemá INSERT/UPDATE/DELETE.

Rollback:
```sql
DROP FUNCTION IF EXISTS public.is_preview_student(uuid);
DROP TABLE IF EXISTS public.preview_students;
```
Filtry pro etapu I2 se dopíšou jako samostatné `CREATE OR REPLACE` pro každou funkci, včetně rollbacku s původní definicí, až po schválení I1.

## Edge funkce (návrh kódu, nevytvářet)
```ts
// supabase/functions/preview-student-switch/index.ts
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";
import { adminClient, issueSession } from "../_shared/demo.ts";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b),
  { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);
  const db = adminClient();
  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", auth.userId);
  const ok = (roles ?? []).some(r => ["admin", "teacher", "lektor"].includes(r.role));
  const { data: demo } = await db.rpc("is_demo_user", { _user_id: auth.userId });
  if (!ok || demo) return json({ error: "Přepnutí na testovacího žáka není dostupné." }, 403);

  let { data: ps } = await db.from("preview_students").select("student_id").eq("owner_id", auth.userId).maybeSingle();
  if (!ps) {
    const email = `preview-${crypto.randomUUID()}@preview.invalid`; // nikdy se neodesílá
    const { data: u, error } = await db.auth.admin.createUser({ email, email_confirm: true,
      user_metadata: { first_name: "Testovací", last_name: "žák", role: "user" } });
    if (error || !u.user) return json({ error: "Testovacího žáka se nepodařilo vytvořit." }, 500);
    const { data: owner } = await db.from("profiles").select("school_id").eq("id", auth.userId).maybeSingle();
    await db.from("profiles").update({ status: "approved", school_id: owner?.school_id ?? null }).eq("id", u.user.id);
    await db.from("preview_students").insert({ student_id: u.user.id, owner_id: auth.userId });
    ps = { student_id: u.user.id };
  }
  const { data: su } = await db.auth.admin.getUserById(ps.student_id);
  if (!su?.user?.email) return json({ error: "Testovací žák nebyl nalezen." }, 404);
  const session = await issueSession(db, su.user.email);
  await db.from("audit_log").insert({ actor_id: auth.userId, action: "preview_student_switch",
    target_id: ps.student_id }); // sloupce audit_log ověřit
  return json({ session });
});
```
Klient: před přepnutím uloží aktuální relaci do `sessionStorage`, zavolá `setSession(session)` a nastaví příznak „testovací žák“. „Zpět na učitele“ udělá `setSession(uloženáRelace)` a smaže příznak.

## Otázky
1. Má testovacího žáka dostat každá učitelka, nebo jen admin?
2. Zařadit testovacího žáka do tříd/skupin učitelky automaticky, nebo jen tam, kam ho sama přidá?
