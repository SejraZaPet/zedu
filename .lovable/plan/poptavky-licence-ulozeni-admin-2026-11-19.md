# Poptávky licencí: uložení před e-mailem a sekce v administraci (návrh, 2026-11-19)

Jen návrh. Nic se nemění, nespouští ani nenasazuje; SQL je text ke schválení. Navazuje na `demo-prevod-na-ostry-ucet-2026-11-19.md`.

## Ověřený současný stav
- `send-license-inquiry`:
  - honeypot `website` a kontrola rychlosti (< 2 s);
  - povinná pole jméno, e-mail a balíček; délkové limity;
  - rate limit **jen v paměti instance** (3 za minutu na IP) a podle **čitelné IP** (x-forwarded-for);
  - odešle Resend na info@bezli.cz s reply_to žadatele.
- Když chybí klíč, vrátí 503. Když Resend selže, uživatel vidí chybu a **poptávka se nikam neuloží**.
- Volá ji jen `LicenseInquiryDialog` (stránka /licence, tlačítko v demo pruhu vede na /licence).
- Formulář nemá text souhlasu. Zdroj ani demo pár se nepředávají.
- Administrace je jedna stránka `/admin` se sekcemi přes `?tab=` (Admin.tsx, skupiny v SiteHeader). Admin RLS v projektu používá `has_role(auth.uid(), 'admin')`.

## A) Datový model (SQL ke schválení)
Jedna společná tabulka `license_inquiries` pro poptávky z webu, dema a připomínek, rozlišené sloupcem `kind`.
```text
id uuid pk, created_at, updated_at
kind text  'license' | 'demo_transfer'          -- E) společná tabulka
name, email, phone, organization, role, plan, student_count text, message text (≤5000)
source text 'web' | 'demo' | 'event' | 'demo_reminder' | 'other'
source_detail text (≤80, např. hodnota ?akce=)
demo_pair_id uuid NULL  -- BEZ FK
consent_version text NULL, consent_text_hash text NULL
email_status text 'pending' | 'sent' | 'failed', email_error text (jen "HTTP 429" / "missing_key"),
email_attempts int default 0, last_attempt_at timestamptz
handled_status text 'new' | 'in_progress' | 'done' | 'spam' default 'new', handled_note text, handled_at, handled_by uuid
ip_hash text  -- SHA-256(DEMO_IP_SALT|IP), stejná funkce jako demo
```
- `demo_pair_id` je **bez cizího klíče**:
  - úklid dema páry maže a poptávka ho musí přežít, protože je to obchodní záznam;
  - FK by úklid blokoval (RESTRICT) nebo poptávku smazal (CASCADE);
  - při úklidu se hodnota jen nastaví na NULL a doplní se `demo_summary jsonb` (počty listů, prezentací a her v okamžiku poptávky). Admin tak přehled vidí i po smazání dema.
- Práva:
  - REVOKE ALL od anon a authenticated, GRANT ALL service_role;
  - GRANT SELECT, UPDATE authenticated jen pro admin policy: `USING (has_role(auth.uid(),'admin'))`;
  - žádný INSERT ani DELETE z klienta, zápis dělá jen edge funkce;
  - UPDATE omezit triggerem na sloupce handled_* (osobní údaje admin neupravuje).
- Indexy: (created_at desc), (handled_status, created_at), (source), (email_status) WHERE email_status <> 'sent', (ip_hash, created_at).
- Kopie upozornění: nová jednořádková tabulka `admin_settings` (id bool pk, inquiry_cc_email text). Čte a upravuje ji jen admin, funkce ji čte přes service role. Nepatří do `demo_config`, protože se netýká dema.
- Uchování osobních údajů:
  - 24 měsíců od posledního `handled_at` / `created_at`;
  - spam po 30 dnech;
  - týdenní SQL úloha anonymizuje (jméno, e-mail, telefon a zprávu nahradí NULL) a ponechá statistiku.
- Výmaz na žádost: admin tlačítkem „Smazat osobní údaje“ (stejná anonymizace) a záznam o výmazu do audit_log bez obsahu.

## B) Edge funkce `send-license-inquiry`
1. Validace a honeypot beze změny.
2. Rate limit v DB: `demo_rate_events` s kind `license_inquiry` a ip_hash, 3 za minutu a 10 za den. Čitelná IP se nikde neukládá.
3. **Nejdřív INSERT** (email_status pending). Když selže zápis, vrátí 500 a uživatel to zkusí znovu (jediný případ chyby).
4. E-mail na info@bezli.cz (+ cc z admin_settings) se odešle v `EdgeRuntime.waitUntil`, takže odpověď uživateli nečeká na Resend. Použije se sdílený `sendWithRetry` + `reserve_email_send_slot`.
5. Výsledek: sent, nebo failed + `email_error` jen jako kód. Uživatel vždy dostane „Děkujeme, ozveme se“.
6. Pozdější pokus: ruční tlačítko v administraci (nová funkce `resend-license-inquiry`, jen admin) a volitelně noční běh pro failed starší 1 hodiny, nejvýš 3 pokusy. Bez cyklů po minutách.
7. Žádné logování obsahu, jen id, stav a kód. Notifikační e-mail se nezapíše do `email_log` s obsahem.
8. Zdroj:
  - `source` a `source_detail` z formuláře (whitelist hodnot, akce ≤80 znaků);
  - `demo` jen tehdy, když JWT patří demo uživateli a server pár sám dohledá. Klientem poslané `demo_pair_id` se ignoruje;
  - bez platného JWT se `demo` změní na `web`.

## C) Administrace „Poptávky“
- Nová sekce `/admin?tab=inquiries` ve skupině Obchod/CRM, viditelná jen pro admina (stejná kontrola rolí jako ostatní admin sekce + RLS).
- Odznak s počtem `handled_status = 'new'` (HEAD count) v menu.
- Tabulka:
  - sloupce: datum, jméno, organizace, balíček, zdroj (štítek Demo), stav e-mailu, stav řešení;
  - filtry: zdroj, stav, balíček, druh žádosti;
  - hledání bez diakritiky (jako lesson-finder);
  - stránkování po 50;
  - na 390 px karty místo tabulky.
- Detail (boční panel):
  - celá zpráva a „Odpovědět“ (mailto s předmětem);
  - poznámka, změna stavu, „Odeslat e-mail znovu“ u failed;
  - „Smazat osobní údaje“.
- Přehled demo páru: jen počty (listy, prezentace, hry, učebnice) přes admin-only RPC `admin_demo_pair_summary(pair_id)` a datum poslední aktivity. Bez obsahu a jmen.
- Export CSV z aktuálního filtru (UTF-8 s BOM pro Excel).
- Česky, vykání, klávesnice a fokus podle WCAG 2.2 AA.

## D) Zdroj „demo“ a akce
- DemoBanner odkazuje na `/licence?zdroj=demo`. Přednáška pošle `/licence?akce=…` (nebo `/demo?akce=…`, odkud se značka přenese).
- Značka se uloží do `sessionStorage` (`Bezli:inquiry-source`), takže přežije navigaci uvnitř karty. Platí 24 hodin a pak se zahodí.
- Přihlášený návštěvník dema: formulář nic nepředvyplňuje (demo e-mail je vymyšlený). Zobrazí se poznámka „Vyplňte prosím svůj skutečný e-mail“ a server přidá ověřený pár.

## E) Napojení na demo převod
- Stejná tabulka s `kind = 'demo_transfer'` a `source = 'demo_reminder'`.
- Odkaz „Převést práci“ v připomínce povede na `/licence?zdroj=demo-reminder`. Etapa 3 pak doplní token převodu.
- E-mail z `demo_contacts` se do poptávky nekopíruje automaticky. Žadatel ho vyplní sám, protože souhlas u kontaktu dema platí jen pro připomínky.

## F) Testy
- Pořadí: INSERT proběhne před voláním Resendu (mock).
- Resend 429/5xx/chybějící klíč: failed + kód, uživatel dostane 200 „Děkujeme“.
- Honeypot nic neuloží. Rate limit vrátí 429 po limitu.
- RLS: anon, žák a učitel nedostanou nic, admin dostane vše. UPDATE mění jen handled_*.
- Zdroj demo se zapíše jen pro ověřený pár; cizí `demo_pair_id` od klienta se ignoruje.
- Opakované odeslání: attempts+1, stav sent; nejvýš 3 automatické pokusy.
- Dotčené stávající testy: LicenseInquiryDialog (text úspěchu) a dashboard admin menu.

## G) Rizika a otázky
- Rizika:
  - odeslání v pozadí se může ztratit při pádu instance, ale řádek zůstane pending a zachytí ho noční pokus;
  - spam zaplní tabulku (honeypot + DB limit + stav spam);
  - osobní údaje v adminu (jen admin a anonymizace).
- Nelze ověřit bez živého testu: skutečné odeslání přes Resend, doručení do info@bezli.cz a případné přeposílání nebo spam filtr.
- Otázky na Tynu:
  1. Doba uchování 24 měsíců – souhlasíte?
  2. Kopie upozornění: na jakou adresu (nebo zatím žádnou)?
  3. Má formulář dostat zaškrtávátko se zásadami ochrany údajů, nebo stačí odkaz?
  4. Mají poptávky vidět i správci škol, nebo jen administrátor Bezli?
