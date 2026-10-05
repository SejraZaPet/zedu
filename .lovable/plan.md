# Krok 1d – Demo: limity AI a úložiště, zákazy změn účtu, noční úklid

Všechna nová pravidla platí jen pro `is_demo_user()`; pro běžné uživatele vrací kontroly vždy „povoleno“. Seed (`is_demo_seed`), `demo_shared_users` a Demo škola se nikdy nemažou.

## Zjištěný stav
- 38 edge funkcí volá AI bránu přímo, každá zvlášť; společný AI helper ani kvóty neexistují (limity jen u pár funkcí, demo jen na zakládání účtů).
- 14 bucketů; limit velikosti mají jen 4 (10–100 MB), většina bez omezení typu.
- `demo_pairs.last_active_at` existuje, plní ho jen `demo-switch` a `demo-restore`. pg_cron je k dispozici (10 úloh).

## 1) Limity AI
- Tabulka `demo_config` (jeden řádek: `ai_per_account = 5`, `ai_daily_global = 150`, `upload_max_bytes = 2 MB`, `upload_max_files = 20`, `inactive_days = 14`, `cleanup_batch = 50`); jen service role.
- Tabulka `demo_ai_usage (user_id, function_name, created_at)`.
- RPC `demo_ai_reserve(_user_id)` – SECURITY DEFINER, `pg_advisory_xact_lock`, takže souběžná volání limit neobejdou: pro ne-demo vrátí `true` bez zápisu; pro demo zkontroluje oba stropy a rezervaci zapíše. `demo_ai_release(_id)` rezervaci vrátí, když AI volání selže (počítají se tedy jen úspěšná).
- `_shared/demo-ai-guard.ts`: z JWT zjistí uživatele, zavolá rezervaci; při vyčerpání vrátí 429 s textem „Testovací účet má limit AI generování. Pro plný přístup se zaregistrujte.“ Přidám ho na začátek všech 38 AI funkcí (jen pár řádků, logika funkcí beze změny) a funkce znovu nasadím.

## 2) Limity úložiště
- Restrictive politika `demo_guard_upload` na `storage.objects` pro INSERT/UPDATE: pro demo uživatele jen přípony png/jpg/jpeg/webp/pdf/docx/pptx/xlsx, velikost ≤ 2 MB podle `metadata->>'size'` a nejvýš 20 souborů s `owner = auth.uid()`. Ostatní uživatelé: `true`.
- Riziko: u některých nahrávání Storage zapíše velikost až po vložení. Pokud se to v testu potvrdí, doplním kontrolu velikosti triggerem, nebo to jasně uvedu.

## 3) Zákazy změn účtu (server)
- Trigger `demo_guard_profile` na `profiles` (BEFORE UPDATE): demo uživatel nesmí měnit `school_id`, `school`, `email`, `status`, roli či volby ve stylu role ani cizí profil.
- Restrictive politiky na `user_roles` (INSERT/UPDATE/DELETE) a `school_join_requests` a `class_members` INSERT (jen do vlastní demo třídy; zvaní cizích zablokováno).
- E-mail/heslo/smazání účtu jdou přes Auth a edge funkce: `auth.users` měnit nesmím, proto přidám kontrolu `is_demo_user` do edge funkcí, které účty mění nebo mažou (např. smazání účtu, reset hesla, create-school-user), a ve frontendu `ProfilePage` zablokuji pole s hláškou „V testovacím účtu nelze měnit.“ Omezení: přímé volání `auth.updateUser` z prohlížeče serverem zablokovat nejde, protože Auth nesmím upravovat. Demo e-mail je smyšlený a potvrzovací e-maily na `@demo.bezli.cz` se neodesílají, takže změna e-mailu se nikdy nedokončí. Riziko zbývá u změny hesla, která by však ovlivnila jen vlastní dočasný demo účet. Tohle uvedu v závěrečné zprávě.

## 4) Noční úklid
- `AuthContext` už zapisuje `profiles.last_active_at`; úklid bere poslední aktivitu jako maximum z `demo_pairs.last_active_at` a `last_active_at` profilů učitele i žáka dvojice. Navíc `create-demo-session` nastaví `last_active_at`.
- Edge funkce `demo-cleanup` (jen s interním tajným klíčem nebo service rolí): vybere max. 50 dvojic neaktivních ≥ 14 dní, smaže soubory ve storage vlastněné těmi dvěma účty, data dvojice (přes RPC `demo_purge_pair`, které ověří, že oba účty jsou v `demo_pairs`, nejsou v `demo_shared_users` a jsou ve škole demo) a pak oba auth účty. Výsledek zapíše do logu `demo_cleanup_log`.
- pg_cron každou noc ve 3:00 zavolá funkci.
- RPC `demo_reset_seed()` jen pro service roli/admina: idempotentně vrátí ukázkové řádky (`is_demo_seed`) do původního stavu z uloženého snímku `demo_seed_snapshot`, který se pořídí v této migraci. Spouští se jen ručně.

## 5) Captcha
Neimplementuji; v závěru uvedu místo v `create-demo-session` (před `countRecent`).

## Testy (DO blok + jwt claims + SET LOCAL ROLE + RAISE EXCEPTION, vše se vrátí)
AI: demo 5× ano, 6. ne; běžný uživatel bez omezení; globální strop. Storage: velký soubor, nepovolená přípona, 21. soubor zamítnut. Profil a role demo: zamítnuto. Úklid: neaktivní testovací dvojice smazána; počty a otisky ne-demo tabulek, seed a shared beze změny. Build a testy.

## Technické detaily
Migrace `0046_demo_limits`, `0047_demo_cleanup`. Nové soubory `_shared/demo-ai-guard.ts`, `demo-cleanup/index.ts`; úpravy 38 AI funkcí (jeden řádek guardu), `create-demo-session`, `ProfilePage.tsx` a rollback SQL v závěru.
