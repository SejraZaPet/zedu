# Technický správce školy pro ZŠ Testovací (ukázkový účet Akademie)

Jen návrh. Nic se nespouští. Účet Tyny ani žádný cizí účet se nemění. Škola: `e83c8907-8f6e-40ff-9203-1146320ac936`.

## Ověřeno (jen čtení)
- Admin → Uživatelé → „Přidat uživatele“ volá službu `create-user`. Tu smí volat jen admin. Vytvoří potvrzený účet a heslo vygeneruje přímo prohlížeč. Pokud e-mail necháte prázdný, vygeneruje se adresa `…@bezli-lektor.cz` / `…@bezli-student.cz`, kam se uvítací e-mail neposílá. Formulář vyplní jen textovou školu a jednu roli, nevyplní `school_id` ani roli `school_admin`.
- `create-school-user` (hromadný import na `/skola`) vyžaduje volajícího s rolí `school_admin` a správným `profiles.school_id`.
- Mazání: Admin → Uživatelé → koš volá službu `delete-user`.

## 1. Založení (nejmenší zásah: 1 nový účet, 2 zápisy)
1. Tyna: Admin → Uživatelé → „Přidat uživatele“.
   - Jméno: `[AKADEMIE]`, příjmení: `Správce ZŠ Testovací`.
   - E-mail: **nechat prázdný**, vygeneruje se `…@bezli-lektor.cz`. Role: Učitel. Škola (text): `ZŠ Testovací, Praha`.
   - Uložit. Heslo se zobrazí jen v této obrazovce. Nikam ho nekopírovat, později ho admin dohledá v detailu uživatele.
2. Přečíst jeho UUID: `select id from profiles where first_name='[AKADEMIE]' and email like '%@bezli-lektor.cz';`
3. SQL (po schválení, změní jen tento nový účet):
```sql
UPDATE public.profiles
   SET school_id='e83c8907-8f6e-40ff-9203-1146320ac936', school='ZŠ Testovací, Praha', status='approved', preferred_view='school_admin'
 WHERE id='<uuid>' AND first_name='[AKADEMIE]';
INSERT INTO public.user_roles (user_id, role) VALUES ('<uuid>','school_admin') ON CONFLICT DO NOTHING;
```
4. Tyna se v anonymním okně přihlásí tímto účtem → `/skola` → Hromadný import: 1 učitel a 12 žáků (6.A, 7.B), e-maily prázdné. Hesla se zobrazí jen v tisku přihlašovacích údajů. Pak se správce odhlásí.

## 2. E-mail a heslo
- Generované domény `@bezli-lektor.cz` / `@bezli-student.cz` jsou v obou službách vyloučené z uvítacích e-mailů a nejsou to skutečné schránky.
- Heslo vzniká v prohlížeči nebo ve službě a uloží se jen jako přihlašovací heslo. Agent ho nevidí a nikam ho nevypisuje.

## 3. Úklid správce po dokončení
- Hned po importu: odebrat roli, aby účet nic nespravoval.
  `DELETE FROM public.user_roles WHERE user_id='<uuid>' AND role='school_admin';`
- Účet úplně smazat: Admin → Uživatelé → najít `[AKADEMIE] Správce…` → Smazat (služba `delete-user`). Je to vratné jen novým založením. Žáci a učitel zůstanou, protože import je nevlastní správce.
- Alternativa bez mazání: `UPDATE profiles SET status='blocked' WHERE id='<uuid>';`

## 4. Upozornění při zápisech (ověřeno)
| Tabulka | Trigger | Co dělá |
|---|---|---|
| assignments | `trg_assignment_published` | Při `status='published'` vloží `notifications` žákům třídy |
| assignments | `notify_parent_on_assignment_published` | Při zveřejnění HTTP volání `notify-parent` (e-mail rodičům) |
| assignment_attempts | `trg_attempt_submitted` | Jen při UPDATE na submitted → upozornění učiteli |
| assignment_attempts | `attempts_notify_parents`, `notify_parent_on_attempt_graded` | Při INSERT submitted / změně skóre → upozornění a HTTP rodičům |
| assignment_attempts | `add_xp_on_assignment_attempt`, `trg_sync_portfolio_from_attempt` | XP žákovi, položka portfolia |
| class_teachers | `trg_class_teacher_added` | Upozornění učiteli |
| class_members | `course_notebooks_on_class_member` | Založí sešity (žádoucí) |
| notifications | `trg_notification_email`, `trg_send_push_on_notification` | E-mail a push ke každému upozornění |

Dopad: všichni příjemci jsou fiktivní (`@bezli-student.cz`, bez `parent_email`, bez push odběrů), takže skutečná zpráva nikam neodejde. V aplikaci ale vzniknou upozornění a XP.

Obejití jen pro tento skript (bez vypínání triggerů a bez změny chování ostatních):
1. Vložit úkoly, materiály a nástěnku jako `status='draft'`. Trigger reaguje jen na published.
2. Pokusy vložit v pořadí: nejdřív `status='in_progress'` bez skóre, pak `UPDATE` na submitted se skóre. Případně přijmout, že vzniknou jen interní upozornění pro fiktivní účty.
3. Zveřejnit jedním UPDATE `status='published'`. Upozornění vzniknou jen fiktivním žákům a jsou to data, která chceme na screenech, protože zvonek vypadá realisticky.
- `ALTER TABLE … DISABLE TRIGGER` ani `session_replication_role` nepoužívat: vypnuly by triggery globálně a role je navíc neumožňuje.
- Před spuštěním ověřit: `select count(*) from profiles where id in (<žáci>) and (parent_email is not null and parent_email<>'');` musí vrátit 0.
- Do mazacího skriptu z minulého plánu přidat: `DELETE FROM notifications WHERE payload->>'assignment_id' IN (select id::text from assignments where teacher_id=:'t');` a XP/portfolio záznamy žáků z těchto pokusů.

## Ke schválení
1. Založení účtu v admin UI (krok 1) a SQL v kroku 3.
2. Postup úklidu (bod 3) po dokončení importu.
