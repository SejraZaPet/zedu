# E-maily žákům – diagnostika a návrh (jen čtení, nic neodesláno)

## 1. Řetězec a proč se neposílalo
```text
změna v DB (trigger) -> řádek v notifications -> trigger trg_notification_email
  (jen když profil má email + email_notifications_enabled) -> pg_net POST notify-email
  -> kontroly (stáří max 6 h, testovací žák, rodič, settings.notifyEmail) -> send-email
  -> reserve_email_send_slot (1 e-mail / 500 ms, sdílený slot v email_send_rate)
  -> Resend, při 429/5xx 3 opakování (1 s, 3 s, 8 s) -> email_log sent/failed
```
- **Fronta neexistuje.** Každá notifikace = jedno samostatné volání funkce. `email_log` je jen deník, ne fronta. Nyní 0 položek `pending`.
- **Příčina selhání (30 dní, ověřeno v email_log):**
  - „Too many requests (10/s)“: 186× jen **7.–11. 10.** Rate limit (500 ms slot + retry) to od té doby řeší, od 11. 10. žádná taková chyba.
  - **„Doména bezli.cz není ověřena“: cca 870× od 7. 10. do 5. 11.** To je hlavní důvod. Od 5. 11. dopoledne se posílá: od té doby 48 notifikací pro žáky/učitele s povoleným e-mailem, 41 odesláno (zbytek padl ještě na doménu před ověřením).
- **Neúspěšné se neopakují a jsou navždy ztracené.** Retry je jen 3× během pár sekund. `notify-email` navíc odmítne notifikaci starší 6 h (`too_old`), takže ani ruční opakování by je neodeslalo. `email_log` nemá vazbu na `notification_id`.
- Objem: `assignment_new` 677 / 30 dní pro 144 příjemců (cca 20–90 e-mailů v den zadávání), `deadline_soon` 155, `assignment_submitted` 250 (učitelům), `new_message` 63, `assignment_feedback` 51.

## 2. Které události e-mail spouští
| Událost | Notifikace / e-mail |
|---|---|
| Nový úkol zveřejněný **třídě** | ano (`notify_on_assignment_published`) |
| Nový úkol zveřejněný **skupině** | **NE** – trigger má podmínku `class_id IS NOT NULL`. Za 30 dní 20 z 37 zveřejněných úkolů bylo pro skupiny → žáci skupin nedostali nic (ani do zvonečku). |
| Koncept / naplánované | ne; pošle se až při přechodu na `published` |
| Materiál / oznámení | stejný trigger a typ `assignment_new` (nadpis v aplikaci „Nový úkol: …“, e-mail má správnou šablonu podle druhu). Materiál ve výchozím stavu **bez** e-mailu (`notifyEmail`), oznámení s e-mailem. Za 30 dní žádný materiál ani oznámení nevznikl. Jiný typ notifikace neexistuje. |
| Blížící se termín | ano, ale **jen pro třídy** (`notify_deadline_soon` joinuje `class_members`) |
| Změna termínu | ne |
| Ohodnocená / vrácená práce | ano (`assignment_feedback`, vkládá aplikace v detailu úkolu) |
| Nová zpráva v messengeru | ano (`new_message`) – každá zpráva = e-mail |
| Zrušená / změněná hodina | ne |
| Žák odevzdal (učiteli) | ano |

## 3. Žáci a nastavení (počty bez jmen)
- 273 žákovských účtů: 273 má e-mail, 273 ověřený. 11 má smyšlenou adresu (demo / testovací – správně se přeskakují).
- Nastavení: jediný přepínač `profiles.email_notifications_enabled`, výchozí **zapnuto**; 263 zapnuto, 10 vypnuto. Po typech odběr nastavit nejde.

## 4. Návrh opravy (nic nespouštět)
**Etapa A – žáci skupin (DB, nejdůležitější):** rozšířit `notify_on_assignment_published` a `notify_deadline_soon` i na `subject_group_members` (s `NOT is_preview_student`), stejné texty. Platí jen pro nově zveřejněné, nic se zpětně nepošle.
```sql
-- NÁVRH, v notify_on_assignment_published přidat:
INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
SELECT m.student_id, 'assignment_new', 'Nový úkol: ' || NEW.title, COALESCE(NEW.description,''),
  jsonb_build_object('assignment_id', NEW.id, 'group_id', NEW.group_id, 'deadline', NEW.deadline),
  '/student/ulohy/' || NEW.id::text
FROM public.subject_group_members m
WHERE NEW.group_id IS NOT NULL AND m.group_id = NEW.group_id AND NOT public.is_preview_student(m.student_id);
-- Rollback: CREATE OR REPLACE s dnešním tělem funkce (uložím ho doslova před migrací).
```
**Etapa B – nadpisy podle druhu (DB):** „Nový materiál: …“ / „Nové oznámení: …“ místo „Nový úkol“; stejný typ `assignment_new` + `payload.kind`, aby nic nespadlo.

**Etapa C – spolehlivost (edge funkce + DB):** malá fronta `email_outbox` (notification_id unique, attempts, next_attempt_at, status). Trigger jen zapíše řádek; cron po minutě odešle dávku přes Resend batch (max 100 / volání, ≤2 volání/s), backoff 1 min → 5 min → 30 min, max 4 pokusy, starší než 6 h se zahodí. Rollback: drop tabulky + vrátit trigger.

**Etapa D – volitelné:** denní souhrn (digest) místo jednotlivých e-mailů pro zprávy a termíny; odběr podle typu v profilu.

**Přeposlání ztracených:** nedoporučuji. Jde o upozornění z 7. 10.–5. 11., termíny většinou prošly, žáci by dostali desítky starých e-mailů. Případně jen jeden ruční souhrn „aktuálně otevřené úkoly“ po výslovném schválení.

## Rizika
- Spam: skupiny přidají příjemce; zprávy v messengeru už teď posílají e-mail za každou zprávu.
- Zpětné odeslání: žádná etapa nesmí zpracovat staré notifikace (pojistka 6 h zůstává).
- Žák v třídě i skupině stejného úkolu: úkol má buď třídu, nebo skupinu, duplicita nehrozí.

## Soubory
- DB funkce `notify_on_assignment_published`, `notify_deadline_soon`, `trg_notification_email`
- `supabase/functions/notify-email`, `send-email`, `_shared/email-delivery.ts`, `_shared/assignment-email.ts` (+ testy)

## Na co se rozhodnout
1. Schvalujete Etapu A (e-maily a zvoneček i pro skupiny)?
2. Etapa B: odlišné nadpisy pro materiál/oznámení?
3. Etapa C (fronta s opakováním), nebo stačí současný stav, když už doména funguje?
4. Ztracené e-maily: nepřeposílat (doporučuji), nebo jeden souhrn?
5. Digest/odběr podle typu teď, nebo později?
