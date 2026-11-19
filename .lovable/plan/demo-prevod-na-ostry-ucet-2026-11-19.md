# Demo → ostrý účet: uložení práce, připomínky, převod a režim „nástroj“ (návrh, 2026-11-19)

Cílové umístění po schválení: `.lovable/plan/demo-prevod-na-ostry-ucet-2026-11-19.md`. Jde jen o návrh: nic se nemění, nespouští ani nenasazuje. SQL je níže pouze popsané a před spuštěním vyžaduje „schvaluji“.

## A) Současný stav a přesný termín smazání (ověřeno)
- Kandidáty na smazání vybírá `demo_cleanup_candidates()`. Rozhoduje nejnovější z hodnot `demo_pairs.last_active_at` a `profiles.last_active_at` učitele i žáka. Pár se smaže, když je tato hodnota starší než `now() − demo_config.inactive_days` (14). Dávku omezuje `cleanup_batch`.
- **Termín smazání = greatest(tři hodnoty last_active_at) + inactive_days.** Skutečný úklid proběhne až při nejbližším nočním běhu demo-cleanup, takže smazání nastane nejvýš o 1 den později.
- Aktivitu obnovuje:
  - klient (AuthContext) zápisem `profiles.last_active_at`, nejvýš jednou za 15 minut na kartu;
  - `demo-restore` (návrat přes kód) a `demo-switch`, které zapisují `demo_pairs.last_active_at`.
- Návrat přes kód tedy odpočet vynuluje. Každé přihlášení posune smazání o 14 dní. „Prodloužit o 14 dní“ proto dnes fakticky dělá už samotné používání.
- Bezpečné zobrazení klientovi: nová RPC `get_my_demo_expiry()` (SECURITY DEFINER, jen vlastní pár přes auth.uid(), stejný vzor jako `get_my_demo_pair()`). Vrátí `deletes_at` a `days_left`, nic dalšího.
- Mapa dat:
  - Mazání řídí `demo_purge_pair`. Projde všechny tabulky ve schématu public se sloupcem vlastníka (`teacher_id`, `created_by`, `owner_id`, `user_id`, …) a vynechá řádky `is_demo_seed`. Soubory najde `demo_pair_storage_objects`.
  - Pro export a převod se použije **stejný seznam**: obsah, který pár vytvořil, kromě seedu.
  - Hlavní vytvořený obsah: teacher_textbooks/teacher_textbook_lessons, teacher_presentations, worksheets, teacher_game_templates, activity_templates, lesson_plans (+phases), assignments (+attachments), question_bank_items, notebooks/pages, teacher_media.
  - Soubory: teacher-media, lesson-images, assignment-uploads a další, které vrací demo_pair_storage_objects.
- **Nikdy se neexportuje ani nepřevádí:**
  - seed (`is_demo_seed`) a ukázkové učebnice,
  - třídy, žáci, pokusy a odpovědi žáků, portfolio, XP, zprávy,
  - demo_pairs, demo_config a tabulky rate/usage.

## B) Etapa 1 (do 28. 11.): kontakt, export, odpočet
**Data (návrh SQL k potvrzení):**
- Tabulka `demo_contacts`:
  - pair_id (unikátní), email, consent_at, consent_version, consent_text_hash;
  - reminder_3d_sent_at, reminder_1d_sent_at, extended_at;
  - transfer_token_hash, unsubscribed_at, created_at.
- Práva a RLS: GRANT jen service_role, RLS zapnuté bez policy pro authenticated. Klient čte pouze stav přes RPC `get_my_demo_contact_status()` (has_contact, maskovaný e-mail, extended), nikdy samotný e-mail.
- Při `demo_purge_pair` se kontakt smaže ve stejné transakci, tedy rozšíření mazání o jeden řádek.

**Funkce `demo-save-contact`:**
- ověří JWT a `is_demo_user`, pár odvodí na serveru (nikdy z klienta);
- validace e-mailu: zod, ≤254 znaků, bez + aliasů se neřeší;
- povinný `consent: true` a verze textu;
- rate limit přes existující `demo_rate_events`: 5 pokusů za hodinu na pár;
- upsert podle pair_id; akce `delete` kontakt smaže (odvolání souhlasu).

**UI:**
- Dialog „Uložit moji práci“ se nabídne jednou po prvním vytvořeném obsahu. Spouštěč: úspěšné uložení listu, prezentace, hry nebo lekce; v localStorage se zaznamená, že už se dialog ukázal. Kdykoli jde otevřít i z DemoBanneru.
- Text souhlasu: „Souhlasím, aby Bezli použilo můj e-mail jen k připomenutí smazání ukázkového účtu a k převodu mé práce do ostrého účtu. Žádné novinky ani reklamu. Souhlas mohu kdykoli odvolat; e-mail smažeme nejpozději se smazáním dema.“
- Odpočet v DemoBanneru se ukáže od 3 dnů před smazáním (role=status, aria-live polite): „Ukázkový účet se smaže za 3 dny (21. 11.).“ Tlačítka: Prodloužit o 14 dní, Stáhnout práci, Uložit moji práci.
- „Prodloužit“ jde použít jen jednou (extended_at). Jde o samostatnou funkci, ne o zápis klienta, a nastaví `demo_pairs.last_active_at = now()`. Protože běžné přihlášení dělá totéž, tlačítko hlavně uklidní návštěvníka.
- Export „Stáhnout moji práci“ stáhne ZIP v prohlížeči z existujících generátorů bez AI:
  - listy přes stávající tisk/PDF,
  - prezentace přes export pipeline (PPTX/PDF),
  - hry a aktivity jako JSON + PDF přehled,
  - vlastní soubory z úložiště.
  - Limit 50 MB a 200 položek; při překročení se zobrazí zpráva a nabídne export po kategoriích. Žádné odpovědi žáků.
- Mobil 390 px: dialog jako spodní panel, tlačítka pod sebou, klávesnice/fokus podle WCAG 2.2 AA.

## C) Etapa 2 (do 28. 11.): připomínky D−3 a D−1
- Nová funkce `demo-expiry-reminders`. Plánuje se jednou denně stejným mechanismem jako demo-cleanup (pg_cron, `X-Cron-Secret` ověřený proti trezoru `cron_internal_secret`), s časem posunutým před úklid.
- Výběr kandidátů: kontakt existuje, bez unsubscribed_at, a termín smazání podle A) spadá do D−3 (reminder_3d_sent_at je null) nebo D−1 (reminder_1d_sent_at je null).
- Idempotence: příznak sent_at se nastaví podmíněným UPDATE (`… WHERE reminder_3d_sent_at IS NULL RETURNING`) **před** odesláním. Při chybě odeslání se vrátí zpět, aby opakování proběhlo nejvýš jednou.
- Odesílání: dnes notify-email volá send-email se service-role klíčem a send-email zapisuje email_log s **celým obsahem**. Pro demo navrhuji vlastní interní cestu:
  - sdílený helper `_shared/resend-send.ts` (sendWithRetry + `reserve_email_send_slot`), volaný přímo z funkce bez admin session;
  - do email_log jen typ `demo_reminder`, stav a příjemce, bez html/textu.
- Dávky: při >20 kandidátech Resend batch API (až 100 e-mailů na požadavek). Jinak po jednom přes sdílený slot (~2/s). Při 429 platí existující Retry-After a opakování (1/3/8 s); co neodejde, zkusí další den, dokud termín platí.
- Text (krátký): „Váš ukázkový účet Bezli se smaže za 3 dny (datum). Můžete: 1) převést práci do ostrého účtu, 2) stáhnout ji, 3) nic nedělat – vše smažeme.“
  - Odkaz s jednorázovým tokenem (hash v DB, platnost do smazání) vede na stránku „Moje demo“.
  - Patička obsahuje odkaz na odhlášení (`demo-unsubscribe` s tokenem).
- GDPR:
  - účel: připomínka a převod;
  - právní základ: souhlas;
  - doba uchování: do smazání dema nebo převodu, pak smazání;
  - výmaz: odvolání v aplikaci nebo odkazem;
  - kontakt se nesmí použít pro CRM.

## D) Etapa 3: převod (jen návrh)
- Funkce `demo-transfer` volá se z ostrého (ne-demo) účtu se schváleným stavem a tokenem z e-mailu nebo kódem dema. Ověří hash tokenu, nepoužitý stav a e-mail shodný s ostrým účtem (nebo potvrzení).
- Náhled se zaškrtávátky podle kategorií z A). Kopíruje se jen obsah, ne žáci, třídy, výsledky ani seed.
- Kopie dostanou nová ID; vazby (lekce↔učebnice, list↔lekce, obrázky) se přemapují. Soubory se zkopírují do cest nového vlastníka a URL v obsahu se přepíšou.
- Převod probíhá v jedné SECURITY DEFINER funkci a jedné transakci; storage se kopíruje předem do dočasných cest, při chybě se soubory smažou.
- Idempotence a limity: `transfer_completed_at` a mapa ID; nejvýš 3 pokusy za den. Po úspěchu se demo pár smaže včetně kontaktu.
- Vztah k licenci: převedený obsah je soukromý obsah učitele. Školní licence ani schválení se tím neuděluje; učitel bez školy dostane režim „nástroj“ (E).

## E) Etapa 4: režim „nástroj“ (technický rámec, bez ceny)
- Rozlišení bez nové role: učitel s rolí `teacher`, stavem `approved` a bez `school_id` / bez platné `school_licenses` = „nástroj“. Odvozuje se jednou funkcí `account_tier()` na serveru a zrcadlí v klientu.
- Skryje se v SiteHeader a na nástěnce: třídy, žáci, zprávy, rodiče, rozvrh, škola, úkoly pro třídy.
- Zůstane: aktivity, listy, prezentace, hry, živé hry s PINem (žáci bez účtu – už existuje přes join-game), knihovna.
- Vynucení přes RESTRICTIVE policy `tool_guard_*` na tabulky tříd a úkolů, analogie demo_guard. Bez ní by šlo skrytí obejít.
- Limity AI a úložiště: zobecnit `demo-ai-guard` a `demo_config` na limity podle úrovně účtu, bez dopadu na školní učitele.

## F) Kvóta e-mailů
Na návštěvníka nejvýš 2 připomínky + případně 1 potvrzení převodu. Při 60 % vyplněných kontaktů:
- 50 návštěvníků: cca 30 kontaktů → nejvýš 60 připomínek. Rozloží se podle aktivity, typicky 20–30 v jeden den.
- 100 návštěvníků: nejvýš 120 připomínek.
- Po přednášce, kdy začne všem odpočet ve stejný den, hrozí přes 100 za den. Na bezplatném plánu proto nutně placený plán nebo rozložení.

## G) Rizika, testy, neověřitelné
- Rizika:
  - cizí pár (pár odvozovat jen z JWT);
  - únik e-mailu klientovi (pouze RPC s maskou);
  - dvojí odeslání (podmíněný UPDATE);
  - úklid během převodu (zámek páru);
  - nesoulad termínu, když se uživatel přihlásí po e-mailu (d−1 je informativní, nelze tím uškodit).
- Testy:
  - izolace a odmítnutí cizího páru;
  - bez souhlasu nic neuloží;
  - odpočet od 3 dnů a jednorázové prodloužení;
  - výběr D−3/D−1, idempotence a opakování 429;
  - mazání kontaktu při úklidu;
  - export bez žákovských dat;
  - převod: idempotence a vrácení při chybě.
- Bez živého testu nelze ověřit: doručení a spam, skutečný limit Resend batch, export velkých prezentací na telefonu, převod souborů.
- Otázky na Tynu:
  1. Má „Prodloužit“ být, i když běžné přihlášení prodlužuje samo?
  2. Odesílací adresa a doména pro demo e-maily?
  3. Přejde se na placený Resend před 28. 11.?
  4. Má export obsahovat i JSON pro pozdější import?
  5. Smí převod proběhnout i na nový účet bez školy (rovnou „nástroj“)?

## Technické poznámky
- SQL k potvrzení (etapa 1–2):
  - demo_contacts + GRANT service_role + RLS;
  - RPC get_my_demo_expiry, get_my_demo_contact_status, demo_extend_once;
  - rozšíření demo_purge_pair o mazání kontaktu;
  - plán úlohy připomínek.
- Nové funkce: demo-save-contact, demo-expiry-reminders, demo-unsubscribe; později demo-transfer.

## Realizace etap 1–2 (2026-11-19)
- Migrace 0091:
  - `demo_contacts` jen pro service_role;
  - RPC `get_my_demo_expiry`, `get_my_demo_contact_status`, `demo_extend_once`;
  - `demo_claim_reminders` a `demo_release_reminder` jen pro service_role;
  - `demo_purge_pair` maže kontakt ve stejné transakci, FK cascade je pojistka.
- Funkce `demo-save-contact`, `demo-expiry-reminders`, `demo-unsubscribe`. Nic není nasazeno.
- Plánovaná úloha se vytvoří **až po nasazení** funkcí, jinak by denně volala neexistující funkci. Vzor je stejný jako `demo-cleanup-nightly`:
  - `net.http_post` na `/functions/v1/demo-expiry-reminders`;
  - hlavička `X-Cron-Secret` čtená v příkazu přímo z trezoru (`vault.decrypted_secrets`, název `cron_internal_secret`), žádná doslovná hodnota;
  - rozvrh `0 8 * * *` (denně 8:00 UTC, před nočním úklidem ve 3:00).
