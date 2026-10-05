# Krok 1c – Demo režim: izolace návštěvníků + ukázkový obsah

Postup ve dvou samostatně ověřených fázích. Fáze B začne až po úspěšném testu fáze A. Běžní uživatelé (Tyna, Žatec, ostatní školy) se nemění: všechny nové politiky začínají `NOT is_demo_user(auth.uid()) OR ...`, existující politiky ani reálná data se neupravují.

## Fáze A – izolace návštěvníků

1. Projdu jen pro čtení politiky a SECURITY DEFINER funkce, které čtou nebo zapisují data v rámci školy: classes, class_members, class_teachers, subject_groups (+ members), assignments, assignment_attempts, assignment_attachments, profiles (+ RPC se seznamy uživatelů školy), notifications, game_sessions/game_players, notebooks/notebook_pages, portfolio (items/files/comments), conversations/participants/messages, feedback_reports. Výsledek uvedu v závěrečné zprávě.
2. Nové SECURITY DEFINER funkce (STABLE, `search_path = public`):
   - `demo_pair_user_ids(_uid)` – vrací učitele a žáka z mé dvojice, systémový účet „Demo Bezli“ a 8 smyšlených spolužáků,
   - `is_demo_visible_user(_target)` – true pro ne-demo uživatele, jinak jestli `_target` patří do množiny výše,
   - `is_my_demo_class(_class_id)` – třída mé dvojice.
3. Restriktivní politiky `demo_iso_select/insert/update/delete` na výše uvedených tabulkách, vždy podle vlastníka, třídy nebo cíle. U zadání úkolu se navíc zkontroluje cílová třída nebo skupina, aby učitel A nemohl zadat úkol třídě B.
4. Test na dvou dočasných dvojicích A a B: A nevidí třídu, žáky, úkoly, odevzdání ani profil B a nemůže B zadat úkol. Běžný učitel vidí a dělá vše stejně jako dřív (stejné počty viditelných řádků před a po). Potom vše dočasné smažu.

## Fáze B – ukázkový obsah

1. Systémový účet `seed@demo.bezli.cz` („Demo Bezli“, role teacher, Demo škola, náhodné heslo, které se nikam neuloží) a 8 smyšlených žáků `student-1..8@demo.bezli.cz` (česká jména, role user, schválený profil). Všichni mají v `user_metadata` příznak `demo_shared = true`, aby je pozdější úklid nesmazal.
2. Otisk originálů (md5 obsahu a `updated_at`) před kopírováním i po něm, u obou lekcí, obou prezentací a listu.
3. Kopie s `is_demo_seed = true` a vlastníkem Demo Bezli:
   - 2 ukázkové učebnice („Ukázková učebnice – Mediální výchova“, „Ukázková učebnice – Výživa“), soukromé a ne na prodej,
   - lekce zkopírované do `teacher_textbook_lessons`, včetně bloků a presentation_slides,
   - kopie obou prezentací a tištěného listu se zachovaným obsahem.
4. Digitální list „Výživa – opakování (digitální)“ vytvořím stávající AI funkcí `generate-worksheet` z lekce Výživa. Výstup zkontroluji a v případě potřeby ručně doladím, aby obsahoval 4× výběr odpovědi, 3× pravda/nepravda, 1× přiřazování a 1–2× krátkou odpověď, žádné write_lines. Bude mít příznak „AI generováno“ kvůli AI Act. V závěru dostanete plné znění otázek a odpovědí.
5. Nové politiky povolující čtení (permissive SELECT) řádků s `is_demo_seed = true` jen pro `is_demo_user(auth.uid())`. Platí pro worksheets, teacher_textbooks, teacher_textbook_lessons a teacher_presentations. Úpravy a mazání dál blokují guardy z kroku 1a, kopírování funguje přes stávající duplikaci.
6. Funkce `create-demo-session` se rozšíří o jedno volání nové SECURITY DEFINER RPC `demo_seed_pair(pair_id)`, která vše vloží jedním dotazem, aby založení zůstalo rychlé:
   - 8 spolužáků do třídy,
   - úkol „Ukázkový úkol: Výživa – opakování“ s vlastníkem demo učitel,
   - 8 odevzdaných pokusů se skóre zhruba 30–100 % (průměr kolem 65 %), část otevřených odpovědí opravená a 2–3 krátká slovní hodnocení.

   Ukázkový úkol z tištěného listu přidám, pokud ho aplikace u typu `pisemne` podporuje, jinak ho přeskočím a uvedu to. Všechny řádky dvojice se poznají podle id dvojice (třída a úkol), takže pozdější úklid je smaže a sdílených řádků se nedotkne.
7. Stránka /zpravy: demo uživatel uvidí statickou ukázkovou konverzaci (bez zápisů do databáze) s upozorněním „Ukázka. Zprávy fungují, jakmile jsou žáci ve vaší škole přihlášeni.“ Ostatním uživatelům se nic nemění.

## Testování

Všechny body ze zadání: izolace A/B, třída se spolužáky a přehled výsledků, vyplnění úkolu žákem s automatickým skóre, zákaz úprav ukázek a možnost vlastní kopie, shodné otisky originálů, neviditelnost ukázek pro běžného učitele jiné školy i v knihovně, BezliMarketu a vyhledávání, smazání dvojice bez dopadu na sdílené řádky, počty reálných řádků a žádné odeslané e-maily. Na konci build a všechny testy.

## Výstup

Seznam migrací, funkcí a souborů, plné znění digitálního listu, odchylky od zadání, rollback SQL a seznam souborů. Dočasná testovací data budou smazána.

## Technické poznámky

- Migrace `demo_isolation` (fáze A) a `demo_seed_content` (fáze B). Data se vkládají přes datové dotazy a jednorázovou administrátorskou funkci, protože auth uživatele lze vytvořit jen přes Admin API.
- Ve frontendu se změní jen `MessagesPage.tsx` (větvení podle `useDemoPair`) a `create-demo-session/index.ts`.
- Pravidlo do `AGENTS.md`: demo izolace se dělá jen pomocí restriktivních politik a SECURITY DEFINER funkcí nad demo_pairs.
