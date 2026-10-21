# Bezli liga – diagnostika a nejmenší etapy (jen čtení, nic neprovedeno)

## 1. Co je hotové
Databáze (`drizzle/migrations/0059_bezli_league_v1.sql`, `0060_league_week_no_temp.sql`, `0061_class_leaderboard_privacy.sql`):
- Nastavení: `schools.league_enabled` (výchozí vypnuto), `schools.league_name_mode` (přezdívka/iniciála), `classes.league_enabled` (výchozí zapnuto) – 0059 ř. 20–24. Stav dnes: 0 škol zapnuto (Žatec vypnuto, režim přezdívka), všech 21 tříd zapnuto.
- XP: `add_xp` se zdrojem a klíčem (ř. 60–100), napojeno na aktivity, úkoly, lekce, procvičování (ř. 129–161); klientům odebráno (ř. 125–126).
- Liga: `league_week_standings` (živý výpočet z `xp_events`, skupiny po 30 podle ročníku a ligy, ř. 168–199), `close_league_week` (ř. 283–305), `set_league_opt_out` (ř. 269–278), `my_league_status` (ř. 313–322), soutěž tříd a třídní žebříček s ochranou soukromí (0061 ř. 1–38).
- RLS: `league_weeks`, `league_memberships`, `league_opt_outs` nemají žádné pravidlo → přímo je nikdo z aplikace nečte ani nezapisuje, vše jde přes chráněné funkce. `xp_events` a `student_xp`: žák vidí jen svoje.
- Plánovač: cron `close-league-week` existuje v databázi (`5 22,23 * * 0`, 0059 ř. 324–325).

Kód/UI:
- Stránka ligy pro žáka: záložka „Liga“ na `/student/zebricek` – `src/pages/StudentLeaderboard.tsx:96–102` → `src/components/student/LeagueTab.tsx:54–125` (liga, pořadí, odpočet, soutěž tříd, odhlášení ř. 47–50, 70–82).
- Přehled žáka: `PlayerProfileWidget` (`StudentDashboard.tsx:126–132`) ukazuje úroveň, sérii, XP a odznaky, **ligu ne**.
- Školní admin: `src/components/school/SchoolLeagueCard.tsx:16–48`, vloženo v `SchoolAdmin.tsx:417`.
- Učitel: přepínač „Zapojit třídu do soutěže tříd“ `src/components/teacher/LeaderboardSettingsCard.tsx:91–95`, v `TeacherClassDetail.tsx:669`.
- Odznaky ligy: `src/lib/badges.ts:30–36`. Pravidla zrcadlí `src/lib/league-rules.ts:1–65`.

## 2. Zakládání a uzavření týdne – proč je prázdno
Týden se **nezakládá**: aktuální týden se počítá živě z `xp_events`. `league_weeks` je archiv, který plní jen nedělní uzavření (cron), a to **jen pro školy se zapnutou ligou**. Plánovač je, funkce je, ale žádná škola ligu nezapnula → nic se neuložilo. Není to chybějící plánovač ani chyba.

## 3. Zařazení do skupin
Žák nemá „přihlášku“: kdo patří do školy se zapnutou ligou, má ročník a není odhlášen, je automaticky v Bronzu. Skupiny po 30 se tvoří při každém výpočtu podle ročníku a ligy. `league_memberships` dostane řádek až při postupu/sestupu po uzavření týdne (top 5 s XP postupuje, spodních 5 ve skupině ≥10 sestupuje).

## 4. Férové XP a odznaky – hotové
Strop 150/den (pražský čas, včetně bonusu); opakování téže věci týž den ×1/×0,5/×0,2/×0 (10/5/2/0); bonus k prvnímu zápisu dne +5 od 3 dnů série, +10 od 7. Odznaky zlato/stříbro/bronz pro 1.–3. místo s kladným XP při uzavření (0059 ř. 301–305). V datech 503 zápisů od 17. 10., 62 žáků.

## 5. Co zbývá a nejmenší etapy
1. **Pilot Žatec – bez migrace, bez kódu:** správce školy zapne „Bezli ligu“ v `/skola`. Zkontrolovat na žákovském účtu jména, top 10 a odhlášení.
2. **Karta ligy na přehledu žáka (jen UI):** malá karta „Moje liga: Bronz, 4. místo, do konce 2 dny“ nad `PlayerProfileWidget`, čte existující `my_league_status`/`school_league_week`; bez DB.
3. **Úprava plánovače (migrace, volitelná, doporučená před prvním zimním uzávěrem):** v zimním čase běží první spuštění v neděli 23:05 pražského času a uzavřelo by předchozí týden (ještě před zapnutím ligy) – mohlo by tak rozdat postupy a odznaky podle starších bodů. Oprava: spouštět jen v pondělí po půlnoci pražského času.

SQL (NESPOUŠTĚT):
```sql
SELECT cron.unschedule('close-league-week');
SELECT cron.schedule('close-league-week', '5 22,23 * * 0',
  $$SELECT public.close_league_week() WHERE extract(isodow FROM now() AT TIME ZONE 'Europe/Prague') = 1$$);
```
Rollback:
```sql
SELECT cron.unschedule('close-league-week');
SELECT cron.schedule('close-league-week', '5 22,23 * * 0', $$SELECT public.close_league_week()$$);
```
(Jde o úpravu plánovače, ne tabulek; žádná data se nemění.)

## 6. Rizika a ošetření
- Soukromí nezletilých: žebříčky jen přes chráněné funkce, top 10 + vlastní pozice, jména dle školy (výchozí přezdívka), odhlášený žák se nezobrazí; ověřit ručně na žákovském účtu před oznámením žákům.
- RLS: ligové tabulky bez pravidel = uzamčené; neměnit, nepřidávat přímé čtení.
- Demo: demo školy ligu zapnutou nemají, LeagueTab ukazuje demo hlášku; nic neměnit.
- Výkon: výpočet pro jednu školu je malý.
- První týden: body z doby před zapnutím se do aktuálního týdne počítají (od pondělí), což je v pořádku.

Každá etapa jen po zvláštním „schvaluji“; nic se nepublikuje.
