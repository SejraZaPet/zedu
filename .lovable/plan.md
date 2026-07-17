
# Audit ZEdu.cz — nalezené problémy

Bez úprav v kódu. Report seřazený podle závažnosti. Odkazy na soubory a migrace jsou konkrétní. (Report byl vytvořen v předchozím kole na základě 5 paralelních hloubkových auditů — frontend, edge funkce, RLS, granty, storage, secrets.)

---

## 🔴 KRITICKÁ

### K1. `set_user_pin` je rozbité — nikdo si nemůže nastavit ani změnit PIN
- **Popis:** Migrace `20260614155917` provedla `REVOKE EXECUTE ON FUNCTION public.set_user_pin(text) FROM PUBLIC, anon`. Funkce ale nikdy neměla explicitní `GRANT ... TO authenticated`, spoléhala jen na výchozí PUBLIC grant. Po revoke tak `authenticated` uživatelé nemají žádné oprávnění a `supabase.rpc("set_user_pin")` selže s permission-denied.
- **Umístění:** funkce `public.set_user_pin(text)`; volání v `src/pages/Auth.tsx:300` a `src/pages/ProfilePage.tsx:80`.
- **Fix:** SQL migrace — `GRANT EXECUTE ON FUNCTION public.set_user_pin(text) TO authenticated;`

### K2. `SEND_PUSH_SECRET` a `CRON_SECRET` unikly v git historii v plaintextu
- **Popis:** Migrace `20260613174651`, `20260614144849`, `20260614151518` obsahují **hardcoded plaintext hodnoty** shared secretu, které trigger `trg_send_push_on_notification` posílá v hlavičce `X-Internal-Secret` do edge funkce `send-push`. Stejný pattern u `X-Cron-Secret`. Kdokoli s přístupem do git historie může volat `send-push` a rozeslat libovolnou push zprávu libovolnému `recipient_id`.
- **Umístění:** `supabase/migrations/20260613174651_*.sql`, `20260614144849_*.sql`, `20260614151518_*.sql`; validace v `supabase/functions/send-push/index.ts:101-108`.
- **Fix:** Operační — rotovat `SEND_PUSH_SECRET` a `CRON_SECRET` v Supabase secrets, novou SQL migrací přepsat trigger tak, aby secret nebyl v migračním souboru (např. `current_setting('app.send_push_secret', true)` nebo hodnota načtená přes vault).

### K3. `profiles` INSERT policy `pr_insert` — libovolný přihlášený uživatel může založit profil pro cizí `auth.users.id`
- **Popis:** Policy má `WITH CHECK = true` a `TO authenticated` bez omezení. Umožňuje pre-create profilu (včetně `username`, `pin_code`, `login_password`, `school_id`, `parent_email`) pro jakékoli existující auth ID → account-takeover, když útočník zná/uhodne cizí UUID před tím, než si dotyčný vytvoří vlastní profil.
- **Umístění:** policy `pr_insert` na `public.profiles`.
- **Fix:** SQL migrace — nahradit `WITH CHECK (id = auth.uid())` (případně `OR public.is_admin()`).

---

## 🟠 VYSOKÁ

### V1. Migrace `20260614155917` unconditionally smazala všechny push subscription řádky
- **Popis:** `DELETE FROM public.push_subscriptions;` bez WHERE na začátku hardening migrace. `usePushNotifications.refresh()` synchronizuje jen prohlížeč, ne DB. Uživatelé, kteří měli push zapnuté, teď vidí status `subscribed`, ale v DB řádek chybí → žádné push zprávy jim nechodí a UI to nedetekuje.
- **Umístění:** `supabase/migrations/20260614155917_*.sql:1`; `src/hooks/usePushNotifications.ts:30-43`.
- **Fix:** Lovable prompt (frontend) — v `refresh()` po nalezení lokálního `PushSubscription` ověřit existenci řádku v `push_subscriptions`; pokud chybí, re-upsertovat.

### V2. Chybí rate limiting na PIN a username loginu
- **Popis:** `verify-pin` má 4místný prostor (10 000 kombinací) a žádný lockout → brute-force za desítky vteřin. `lookup-username` také bez rate limitingu.
- **Umístění:** `supabase/functions/verify-pin/index.ts`, `supabase/functions/lookup-username/index.ts`.
- **Fix:** SQL migrace + edge funkce — tabulka `login_attempts` (per username + IP), lockout okno.

### V3. `game_players` INSERT policy s `WITH CHECK = true` pro roli `public`
- **Popis:** Anonymní/přihlášený klient může přes REST API vložit řádek s libovolným `user_id` (spoof identity). Edge funkce `join-game` to dělá správně přes service role, ale přímý insert z klienta obchází její logiku.
- **Umístění:** policy `Anyone can join a game` na `public.game_players`.
- **Fix:** SQL migrace — `WITH CHECK ((auth.uid() = user_id) OR (user_id IS NULL))`.

---

## 🟡 STŘEDNÍ

### S1. `lookup-username` provádí duplicitní `signInWithPassword`
- **Popis:** Edge funkce ověří heslo server-side (throwaway anon klient), potom prohlížeč volá `signInWithPassword` znovu → 2× GoTrue rate limit per login.
- **Umístění:** `supabase/functions/lookup-username/index.ts:44-55`; `src/pages/Auth.tsx:106-116`.
- **Fix:** Lovable prompt — nahradit ověření hashovou kontrolou proti `profile_credentials` přes SECURITY DEFINER RPC.

### S2. Timing side-channel v `lookup-username`
- **Popis:** Miss vrací okamžitě; hit čeká na round-trip `signInWithPassword` → enumerace existujících uživatelských jmen.
- **Umístění:** `supabase/functions/lookup-username/index.ts:33-55`.
- **Fix:** Edge funkce — při miss provést dummy-cost bcrypt compare.

### S3. `SchoolAdmin.tsx` role-grant/revoke UI může tiše selhat
- **Popis:** Migrace `20260613125852` vytvořila `user_roles_insert_admin`/`_delete_admin` s `is_admin()`-only kontrolou. Není potvrzeno, zda školní-admin write policies z `20260504081354` živě koexistují. Pokud ne, `SchoolAdmin.tsx:166-193` tiše no-op pro `school_admin`.
- **Fix:** Ověřit v `pg_policies` a případně SQL migrací obnovit školní-admin write policies.

### S4. `send-push` nedělá cleanup na 401/403 responsech
- **Popis:** Maže subscription jen při 404/410. Při budoucí rotaci VAPID klíčů vrátí push service typicky 401/403 → subscription zůstane a bude selhávat donekonečna.
- **Umístění:** `supabase/functions/send-push/index.ts:146-150`.
- **Fix:** Lovable prompt — rozšířit catch větev o 401/403.

### S5. Několik SECURITY DEFINER funkcí má implicitní PUBLIC grant
- **Popis:** `find_student_by_code`, `join_class_by_code`, `enroll_by_textbook_code`, `join_school_by_code`, `join_class_as_teacher` nemají explicitní `GRANT`. Nekonzistentní s ostatními a zvyšuje riziko podobného breakage jako K1.
- **Fix:** SQL migrace — explicitně `REVOKE ... FROM PUBLIC, anon` a `GRANT EXECUTE ... TO authenticated`.

### S6. `ProtectedRoute` nekontroluje roli — jen login+status
- **Popis:** `src/components/ProtectedRoute.tsx` gatuje jen `isLoggedIn` a `status='approved'`. Role check dělá každá stránka sama. Není bypass (RLS drží), ale UX chrome se krátce renderuje.
- **Fix:** Lovable prompt (frontend) — přidat `allowedRoles` prop.

### S7. Migrace `20260516101438` hardcoduje reálný PIN uživatele `mherink` = `9915`
- **Umístění:** `supabase/migrations/20260516101438_*.sql:25-26`.
- **Fix:** Operační — resetnout PIN, do budoucna netahat plaintext credentials do migrací.

---

## 🟢 NÍZKÁ

### N1. `child_code` link v `handle_new_user` selhává tiše
- **Popis:** Špatný `child_code` → výjimka spolknuta (`RAISE WARNING`), rodič ve UI o neúspěchu neví.
- **Fix:** Lovable prompt (frontend) — po signupu ověřit `parent_student_links` a toast s výzvou přidat kód.

### N2. VAPID key rotation nemá guard
- **Popis:** `pushConfig.ts:4` a `send-push/index.ts:11` shodné, ale nic to nekontroluje. Při rotaci half-update potichu rozbije push.
- **Fix:** Doprovodit S4; volitelně build-time assert.

### N3. `push_subscriptions.user_id` bez FK
- **Fix:** SQL migrace — `REFERENCES auth.users(id) ON DELETE CASCADE`.

### N4. `viewAsRole` v localStorage
- Kosmetický flag, `isAdmin` gate v `AuthContext.tsx:145-163` z DB. Bezpečné, record only.

---

## Oblasti bez nálezu (5 rizikových oblastí z requestu)

- **Push notifikace kryptografická vrstva:** VAPID public key v `pushConfig.ts` a `send-push/index.ts` je identický, historie v gitu nikdy nerotovala. RLS na `push_subscriptions` je správně scoped. **ALE viz K2, V1, S4.**
- **PIN login RPC path:** `verify_pin_login` nebyl nikdy dotčen revoke migracemi, `service_role` ho volá bez problému. **ALE viz K1 a V2.**
- **Registrace rodiče:** `Auth.tsx:230-249` posílá `status: "pending"` bez override; `handle_new_user` (verze `20260614172203`) přiřazuje roli `rodic` a status pending; `ProtectedRoute` gatuje `/rodic`. Předchozí regrese (`auto_approve_on_email_confirm`) byla revertována v `20260614173647`. **Bez aktivní chyby.**
- **Viditelnost rolí:** Nová policy `user_roles_select_scoped` zahrnuje admin, school_admin, teacher-of-student, parent-of-student — dostatečně široká. Helper funkce mají `EXECUTE` pro `authenticated`. **Bez regrese**, jen viz S3.
- **`lookup-username`:** Server-side ověření hesla je funkčně korektní. **ALE viz S1, S2, V2.**

---

## Otevřené otázky (vyžadují živý dotaz do DB)

1. `pg_policies` diff pro `user_roles` — koexistence školně-adminových write policies (viz S3).
2. Pinpoint souboru pro K3 (`grep -rn "pr_insert" supabase/migrations/`).
3. Živé hodnoty `SEND_PUSH_SECRET` / `CRON_SECRET` — potvrdit rotaci (viz K2).
4. Kolik uživatelů má `Notification.permission='granted'` bez řádku v `push_subscriptions` (dopad V1).
5. `supabase--linter` běh — v tomto auditu neproveden.

---

## Souhrn dle typu opravy

- **SQL migrace:** K1, K3, S3, S5, V3, N3, + trigger refactor pro K2
- **Lovable prompt (frontend/edge funkce):** V1, V2, S1, S2, S4, S6, N1
- **Operační (secrets, PIN reset):** K2, S7
