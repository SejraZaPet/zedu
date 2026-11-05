# E-maily o úkolech: proč nechodí a návrh opravy

## Souhrn pro učitelku
- **E-maily dnes nechodí nikomu, žádné.** Za posledních 30 dní selhalo 876 e-mailů o upozorněních, protože odesílací doména bezli.cz není ověřená u poskytovatele e-mailů. Dalších 246 selhalo kvůli limitu 10 e-mailů za sekundu. Úspěšně odeslaný nebyl žádný. Selhalo i 6 e-mailů pro obnovu hesla.
- Upozornění **v aplikaci** se vytvářejí (752 za 30 dní). Kopie e-mailem se zkouší posílat, ale neprojde.
- **Druhá chyba:** úkol zadaný **skupině** (ne třídě) nevytvoří žákům vůbec žádné upozornění, ani v aplikaci. Za posledních 30 dní to bylo 20 z 37 zveřejněných úkolů.
- Upozornění „po termínu neodevzdáno“ dnes neexistuje. Existují jen připomínky před termínem.
- Řešení:
  - **Krok 0:** ověřit doménu pro odesílání. Udělá to správce domény, jinak žádný e-mail nepůjde.
  - **Fáze 1** (jen kód): lepší e-mail „Nový úkol“ a respektování druhů Materiál/Oznámení.
  - **Fáze 2** (databáze, jen po schválení): upozornění u skupin, „neodevzdáno“, souhrny, noční klid a záznam odeslaných e-mailů.

## 1. Jak to funguje dnes (ověřeno)
- Při zveřejnění úkolu běží trigger `notify_on_assignment_published`. Ten vloží do `notifications` záznam „Nový úkol: …“, jen když má úkol `class_id`. Úkoly pro skupiny (`group_id`) se **přeskočí**. Testovací žáci jsou vynechaní.
- Trigger `notification_email_after_insert` zavolá u každé notifikace `notify-email`, a ten pak `send-email`. Notifikaci se tak pošle obecný e-mail: nadpis, popis a „Otevřít v Bezli“. Termín, předmět ani učitel v něm nejsou.
- `notify-email` přeskočí:
  - testovacího žáka
  - adresy `@preview.invalid`
  - žáky bez e-mailu nebo s vypnutými e-maily (`profiles.email_notifications_enabled=false`)
  - rodiče (ti mají vlastní kanál `notify-parent`)
  - notifikace starší než limit `isTooOld`
- `send-email` blokuje demo adresy a `@preview.invalid` a vše zapisuje do `email_log`.
- Push upozornění posílá trigger `notifications_send_push` → `send-push`.
- Rodiče: `trg_notify_parent_assignment_published` volá `notify-parent`, ale také jen u `class_id`.
- Plánované úlohy:
  - `notify-deadline-soon-daily` (7:00 UTC) → `notify_deadline_soon()`
  - `auto-reminders-job-daily` (8:00 UTC): připomínka úkolů s termínem za 24–48 h těm, kdo nedokončili. Cíle bere přes `reminder-targets` (třída i skupina) a vynechává testovací žáky.
  - Upozornění „po termínu“ neposílá žádná z nich.
- Žáci: 274 účtů, všichni mají e-mail v profilu, 10 má e-maily vypnuté, 1 je testovací.
- Odesílání běží přes vlastní klíč poskytovatele Resend. Vestavěné e-maily Lovable nejsou pro projekt nastavené.

## 2. Proč e-mail nepřijde, seřazeno podle dopadu
1. Neověřená doména bezli.cz. Selže tím 100 % e-mailů.
2. Limit 10 požadavků za sekundu. Hromadné zadání třídě odešle 25+ e-mailů naráz a část selže. Opakování chybí.
3. Úkoly pro skupiny upozornění vůbec nevytvoří.
4. Vypnuté e-maily (10 žáků), a to záměrně.
5. Notifikace starší než limit se už neposílají.

## 3. Návrh řešení

### Krok 0 (bez kódu, nutný)
Doménu pro odesílání je nutné ověřit. Jsou dvě možnosti:
- Ověřit bezli.cz u stávajícího poskytovatele (DNS záznamy přidá správce domény).
- Doporučeno: přejít na vestavěné e-maily Lovable s poddoménou např. `notify.bezli.cz`. Ty mají frontu, opakování a hlídání limitu, takže řeší i bod 2. Přechod se dá udělat i později, až doména funguje.

Do té doby se žádný e-mail neodešle, bez ohledu na ostatní opravy.

### a) E-mail „Nový úkol“ (žákům se tyká)
- Předmět: `Nový úkol: {název} ({předmět})`
- Text:
  - „Ahoj, {učitel} ti zadal(a) nový úkol v předmětu {předmět} pro {třída/skupina}.“
  - Termín: „čtvrtek 12. 11. 2026, 23:59“ (pražský čas). Bez termínu: „Bez termínu“.
  - Popis: prvních 300 znaků jako prostý text (`assignmentDescriptionToText`).
  - Pokud lze odevzdat po termínu: „Odevzdat můžeš i po termínu, nejpozději do …“ nebo „… bez omezení“.
  - Tlačítko „Otevřít úkol“ vede na `/student/ulohy/{id}`.
- Materiál: „Nový materiál: {název}“ s tlačítkem „Otevřít materiál“, bez termínu. Výchozí stav: neposílat.
- Oznámení: „Oznámení od {učitel}: {název}“ s textem do 300 znaků. Výchozí stav: posílat.
- Rodičům (volitelné, beze změny chování): stávající `notify-parent`, doplněný o termín.

### b) Automatická upozornění
- **Připomínka před termínem:** sjednotí se do jedné úlohy (dnes jsou dvě, `notify_deadline_soon` a `auto-reminders-job`, a mohou se zdvojovat). Posílá se 1× zhruba 24 h před termínem.
- **„Neodevzdáno – po termínu“:**
  - 1× poprvé v povoleném čase (7–20 h) po termínu
  - Text: „Úkol {název} jsi neodevzdal(a) do termínu {datum}.“ Když je pozdní odevzdání povolené, navíc: „Ještě ho můžeš odevzdat do …“.
- **„Poslední den“:** jen když je `lateUntil` datum, 1× v den konce.
- Pravidla:
  - Nikdy tomu, kdo odevzdal (existuje pokus `submitted`, i skupinový).
  - Nikdy u materiálu a oznámení.
  - Nikdy testovacím žákům ani demo uživatelům.
  - Respektovat `email_notifications_enabled`.
  - Max. 1 e-mail na úkol, žáka a typ (log v databázi).
  - Odesílání jen 7–20 h pražského času.
  - Víc úkolů naráz = jeden souhrnný e-mail „Máš 3 neodevzdané úkoly“.
  - Rodiče jen pokud mají zapnuté e-maily o dítěti (`parent_email_notifications`).
- Upozornění v aplikaci se vytvoří vždy (i bez e-mailu), pokud ho učitel nevypne.

### c) Volby u učitele ve formuláři
Uloží se do `settings`, bez nového sloupce:
- „Poslat žákům e-mail“: `settings.notifyEmail`. Výchozí: zapnuto u úkolu a oznámení, vypnuto u materiálu.
- „Automaticky upozornit, když neodevzdají“: `settings.notifyOverdue`. Výchozí zapnuto, jen u úkolu.

Chybějící hodnota = výchozí podle druhu. Stávající úkoly tak automaticky dostanou upozornění „neodevzdáno“ až od fáze 2 a jen u úkolů s budoucím termínem; staré úkoly po termínu se zpětně nerozešlou.

### d) Návrh DB (NESPOUŠTĚT)
```sql
CREATE TABLE public.assignment_notifications_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('new','reminder','overdue','late_last_day')),
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','inapp')),
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX assignment_notifications_sent_once
  ON public.assignment_notifications_sent (assignment_id, student_id, kind, channel);
GRANT ALL ON public.assignment_notifications_sent TO service_role;
ALTER TABLE public.assignment_notifications_sent ENABLE ROW LEVEL SECURITY;
-- Žádné politiky pro authenticated/anon: tabulku čte a zapisuje jen server (service_role).
```
Rollback: `DROP TABLE IF EXISTS public.assignment_notifications_sent;`

Úprava triggeru `notify_on_assignment_published` (připraví se s plným původním zněním a md5 jako u I2b):
- doplnit větev pro `group_id`, tedy členy `subject_group_members.student_id`
- vynechat kind material, pokud `notifyEmail` není true
- respektovat `settings.notifyEmail=false` přes `payload.email=false`; `notify-email` ho pak přeskočí

Totéž pro `trg_notify_parent_assignment_published`.

Plánovaná úloha:
- `assignment-notify-job` 1× za hodinu v 7–20 h pražského času, tj. 14 běhů denně. Cron `0 5-19 * * *` v UTC (pozor na změnu času).
- Hledá úkoly s termínem v okně připomínky a úkoly po termínu bez odevzdání.
- Zapisuje do logu (unikátní index brání dvojímu odeslání).
- Posílá souhrn na žáka.
- Nahradí `auto-reminders-job-daily` a `notify-deadline-soon-daily`. Ty se vypnou až po ověření nové úlohy (rollback: znovu zapnout).

## 4. Fáze

**Fáze 1 – jen kód, bez DB (po „schvaluji fázi 1 e-mailů“)**
1. `notify-email`: nová šablona pro `type='assignment_new'`. Načte úkol, předmět, učitele, třídu/skupinu, termín, `lateUntil` a druh. Pokud chybí `settings.notifyEmail` a druh je materiál, e-mail neposílá.
2. `send-email`: rozložit dávky pod limit 10/s (pauza a 1 opakování při 429).
3. Formulář úkolu: volby „Poslat žákům e-mail“ a „Automaticky upozornit, když neodevzdají“ (uložení do `settings`). Druhá volba začne fungovat až ve fázi 2; do té doby u ní bude text „bude aktivní po zapnutí automatických upozornění“.
4. Testy (Deno): formát data „čtvrtek 12. 11. 2026, 23:59“, zkrácení popisu na 300 znaků, texty pro úkol/materiál/oznámení, přeskočení testovacího žáka, dávkování.
5. Nasazení edge funkcí jen po „nasadit“.

**Krok 0 – doména (učitelka nebo správce)**
Bez něj fáze 1 nic nedoručí.

**Fáze 2 – DB a plán (po „schvaluji fázi 2 e-mailů“)**
1. Uložit rollback (původní definice triggerů a md5).
2. Migrace: log tabulka a úprava triggerů (skupiny, volby).
3. Nová edge funkce `assignment-notify-job` (suchý běh `dryRun: true` vrátí jen počty) a cron.
4. Vypnout staré dvě úlohy až po zeleném suchém běhu.

## 5. Rizika
- **Příliš mnoho e-mailů:** řeší log, souhrny, noční klid a výchozí vypnutí u materiálu.
- **Nezletilí a GDPR:** e-mail žákovi jde na školní adresu z profilu. Rodičům jen podle jejich vlastní volby. V e-mailu nejsou známky ani odpovědi, jen název, termín a odkaz. Odhlášení: odkaz na profil je v patičce.
- **Limity poskytovatele:** 10/s a denní kvóta. Vestavěné e-maily Lovable to řeší frontou.
- **Spam:** ověřená doména (SPF/DKIM) je nutná. Bez ní e-maily padají do spamu nebo se neodešlou.
- **Hromadné rozeslání starých záznamů:** `isTooOld` a fáze 2 zakazují zpětné rozeslání úkolů po termínu.
- **Dvojí připomínky** ze dvou stávajících úloh: vyřeší sjednocení ve fázi 2.

## 6. Ověření bez e-mailů skutečným žákům
- Unit testy šablon a pravidel (Deno, Vitest).
- Suchý běh `assignment-notify-job` s `dryRun: true`: vrátí jen počty (kolik nových, připomínek a „neodevzdáno“), bez jmen a adres.
- Jeden `[TEST]` úkol pro testovacího žáka. Jeho adresa `@preview.invalid` se nikdy neodešle, `email_log` ukáže „skipped“. Skutečné doručení se ověří na adresu učitelky, s jejím souhlasem a po ověření domény.
- Kontrola `email_log`: jen počty stavů a chybových kódů.
- Úklid jen `[TEST]` dat vytvořených agentem.

Nic se nespustí bez „schvaluji fázi 1 e-mailů“ / „schvaluji fázi 2 e-mailů“ a nic se nenasadí bez „nasadit“.
