## Výsledek ověření SchoolAdmin.tsx po obnovení RLS policies

### 1. Kontrola zpracování chyb při grant/revoke rolí

**`toggleRole()` (řádky 179–201) — OK ✅**
Insert i delete na `user_roles` mají zachycený `error` a při selhání zobrazí toast `"Chyba"` s `error.message`. Po obnovení RLS policies bude tato funkce fungovat správně a případné budoucí RLS selhání se uživateli zobrazí.

**`removeFromSchool()` (řádky 203–214) — OK ✅**
Update `profiles.school_id = null` má správně ošetřený error state s toastem.

**Invite flow (řádky 161–168) — BUG 🟠 (tiché polykání chyb)**

```ts
await supabase.from("profiles").update({ school_id: school.id, status: "approved" }).eq("id", signed.user.id);
if (invRole === "teacher") {
  await supabase.from("user_roles").delete().eq("user_id", signed.user.id).eq("role", "user");
  await supabase.from("user_roles").insert({ user_id: signed.user.id, role: "teacher" });
}
```

Tři po sobě jdoucí Supabase volání **nemají žádný `error` handling**:
- `profiles.update({ school_id, status: 'approved' })` — pokud selže na RLS, uživatel zůstane bez školy a `pending`, ale UI zobrazí „Uživatel pozván" jako úspěch.
- `user_roles.delete(... role='user')` — pokud selže, zůstane duplicitní role `user` vedle `teacher`.
- `user_roles.insert({ role: 'teacher' })` — pokud selže na RLS (např. mimo vlastní školu, nebo pokud by policy měla `WITH CHECK` na `profiles.school_id` které ještě nebylo commitnuto), učitel se **nevytvoří vůbec**, ale toast řekne že byl pozván.

Toto je přesně ten typ „tichého selhání", na který se ptáte. Původní S3 finding z auditu tedy stále platí pro invite flow, i když `toggleRole` byl OK.

### 2. Ověření RLS chování z pohledu school_admin role

Nemohu spustit `SET LOCAL role authenticated` + `SET request.jwt.claim.sub` bez service_role přístupu ze sandboxu (read-only query tool nedovoluje session-level GUC změny). Pro reálné ověření doporučuji jednu z variant:
- pgTAP test spuštěný v Supabase SQL editoru s `set_config('request.jwt.claims', ...)` a `SET ROLE authenticated`,
- ruční test přes UI na dvou testovacích školách.

Nový policy set (INSERT/DELETE scoped přes `is_school_admin(auth.uid())` + shodné `profiles.school_id`) je strukturálně správný a odpovídá vzoru z ostatních tabulek — po commitu by měl fungovat pro vlastní školu a zamítnout cizí školu.

### 3. Shrnutí

- **`toggleRole` (přepínání teacher/user na existujícím členovi)** — po SQL migraci funguje a chyby se korektně propisují do UI.
- **Invite flow (pozvat nového uživatele)** — funkčně poběží, ale **3 database volání tiše polykají chyby**. Pokud kterékoliv z nich selže (RLS, síť, race condition mezi trigger-created rolí `user` a delete), uživatel se dozví „Uživatel pozván" a školní admin nezjistí, že učitel nedostal správnou roli.

### Navrhovaná oprava (čekám na souhlas)

Do `invite()` doplnit error handling pro všechna tři volání, po první chybě přerušit s destructive toastem popisujícím krok, který selhal:

```ts
const { error: profErr } = await supabase.from("profiles").update({...}).eq(...);
if (profErr) { toast({ title: "Nepodařilo se přiřadit ke škole", description: profErr.message, variant: "destructive" }); setSubmitting(false); return; }

if (invRole === "teacher") {
  const { error: delErr } = await supabase.from("user_roles").delete()...;
  if (delErr) { toast({ ... }); setSubmitting(false); return; }
  const { error: insErr } = await supabase.from("user_roles").insert(...);
  if (insErr) { toast({ title: "Role učitel nebyla přidělena", description: insErr.message, variant: "destructive" }); setSubmitting(false); return; }
}
```

Pouze presentation/error-handling změna, žádná byznys logika.

**Nic jsem needitoval — čekám na potvrzení, zda mám opravit invite flow.**