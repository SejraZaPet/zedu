# Bezli liga v1 – diagnostika a plán

## Co už existuje
- `add_xp(student, amount)` (SECURITY DEFINER): přičte XP, level, sérii dnů, odznaky XP/level/série. Bez zdroje, bez stropu, bez logu.
- Volají ho triggery: výsledek aktivity (podle skóre, jen přírůstek), odevzdání úkolu 20 (dvakrát – attempts i submissions), lekce 15, procvičování 10.
- `class_leaderboard(class)` – všichni členové třídy, celkové XP (bez jmen).
- `student_xp` (112 řádků), `student_badges` – žák vidí jen své, učitel své žáky, zápis jen admin (žák XP zapisovat nemůže – v pořádku).
- `classes.year`, `classes.school_id`, `classes.leaderboard_enabled`, `profiles.school_id`, `profiles.username`.

## Co chybí
`xp_events`, `school_league_week`, ligy Bronz–Diamant, skupiny po 30, `league_*` sloupce, opt-out, uzavření týdne (pg_cron), odznaky league_*, soutěž tříd, záložka „Liga“. Odznaky za umístění v `badges.ts` nejsou.

## Pravidla (výchozí hodnoty)
- Denní strop ligových XP: **150**.
- Opakování téže lekce/aktivity v jeden den: **100 %, 50 %, 20 %, 0 %** (u 10 XP = 10, 5, 2, 0).
- XP podle výsledku: zůstává dnešní poměr skóre (aktivita).
- Bonus za sérii: **+5 XP** při prvním zápisu dne od 3. dne série, **+10** od 7. dne (do stropu).
- Odevzdání úkolu: jen jednou (trigger na attempts; druhý trigger ze submissions přestane přidávat, aby nevznikalo zdvojení).
- Žádné zpětné přepočty: stávající `total_xp` beze změny, liga počítá jen nové `xp_events` od nasazení.
- Liga: skupiny po nejvýš **30** žáků stejné školy a ročníku a stejné úrovně (Bronz → Stříbro → Zlato → Diamant). Začátek: všichni Bronz.
- Konec týdne: neděle 23:59 (Praha). Postup: top **5** skupiny (s alespoň 1 XP), sestup: posledních **5** (jen při skupině ≥ 10, z Bronzu se nesestupuje). Odznaky `league_gold/silver/bronze` pro 1.–3. místo ve skupině.
- Soutěž tříd: průměr týdenních XP aktivních členů (≥ 1 XP v týdnu), jen třídy stejné školy. Učitel vypíná přepínačem u třídy.
- Zobrazení: přezdívka (username) nebo „Jméno P.“ podle školy; avatar Zedík; top 10 + vlastní pozice; nikdy body/jména pod top 10 kromě sebe.
- Liga jen pro školy se zapnutou ligou (výchozí vypnuto); demo účty (`is_demo_user`) a odhlášení žáci se do skupin nedostanou ani nezobrazí.

## Migrace (čeká na schválení)
1. `xp_events` (user_id, source, source_key, amount, created_at) – žák čte jen své, zápis nikdo (jen funkce).
2. `schools.league_enabled bool default false`, `schools.league_name_mode text default 'nickname'`, `classes.league_enabled bool default true`.
3. `league_opt_outs(user_id)` – žák vloží/smaže jen sebe.
4. `league_memberships(user_id, tier)` a `league_weeks(week_start, school_id, grade, tier, group_no, user_id, xp, rank, result)` – bez přímého čtení pro žáky.
5. Nová `add_xp(student, amount, source, source_key)`; stará dvouparametrová volá novou se zdrojem `legacy`. Strop, klesající zisk a série uvnitř. Triggery předají zdroj a klíč (lekce/aktivita/úkol).
6. RPC: `school_league_week()` (top 10 skupiny + já, jen pořadí, jméno, avatar id, body, příznak já), `class_league_week(class)` (průměry tříd školy), `set_league_opt_out(bool)`, `close_league_week()` (jen cron/servis).
7. pg_cron: neděle 23:59 Praha `close_league_week()`.
8. Demo: všechny nové tabulky dostanou RESTRICTIVE `demo_guard_*` politiky; demo uživatelé vyloučeni ve funkcích.

## Aplikace
- `src/lib/league-rules.ts` (čistá pravidla zrcadlící SQL) + testy: strop, klesající zisk, série, postup/sestup, průměr třídy, ořez na top 10 + já.
- Záložka „Liga“ v StudentLeaderboard: úroveň, skupina top 10 + já, odpočet do neděle, přepínač „Zapojit se do ligy“, vysvětlení když liga není zapnutá; soutěž tříd.
- Správce školy: přepínač ligy a režim jména na /skola. Učitel: přepínač „Soutěž tříd“ v LeaderboardSettingsCard.
- `badges.ts`: league_gold/silver/bronze.

## Ostrá zkouška
Zkušební škola „[TEST] Liga“ se 3–4 testovacími žáky, simulace XP, ruční uzavření týdne, ověření postupu a že žák nevidí cizí detaily; potom smazat jen tato data.

## Rizika
- Změna `add_xp` zasahuje všechny zdroje XP – stará signatura zůstane, celkové XP se dál přičítá (strop jen pro ligové XP? ne: strop platí pro nové XP celkově, jinak by šly obcházet). Rozhodnutí: strop platí pro všechny nové XP.
- Odebrání zdvojení u odevzdání úkolu mění počet XP za úkol z 40 na 20.
