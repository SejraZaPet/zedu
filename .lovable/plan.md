# Demo: ochrana proti zneužití, limity obsahu a režim „samostatný učitel zdarma"

Pouze plán. Bez kódu, migrací a nasazení. Každá DB změna níže čeká na výslovné „schvaluji".

## 0. Současný stav (ověřeno v kódu a čtecími dotazy)

- `create-demo-session`: limit **20 dem/h na hash IP**, **80/h** jen pro štítek přesně `dalkove-ucitele` (`HIGH_CAPACITY_EVENT_TAGS`), globálně **500/den**. Události v `demo_rate_events` (kind `create`, `ip_hash`). Každé kliknutí vždy zakládá novou dvojici učitel+žák, třídu a seed (`demo_seed_pair`).
- `ipHash`: SHA-256(`DEMO_IP_SALT` | IP); holá IP se neukládá. Hash se ukládá i do `demo_pairs.ip_hash`.
- Prohlížeč: `localStorage["Bezli:demo-return-code"]` drží návratový kód; `demo-restore` umí návrat. **Při novém kliknutí na „Vyzkoušet zdarma" se ale kód nekontroluje** – vznikne nové demo.
- `demo_config` (jeden řádek): `ai_per_account=5`, `ai_daily_global=150`, `upload_max_bytes=2 MB`, `upload_max_files=20`, `inactive_days=14`, `cleanup_batch=50`, `reminder_max_per_run=60`.
- AI: `demo-ai-guard.ts` → `demo_ai_reserve` (per účet + globálně za den). Nic per zařízení/IP.
- Úložiště: `demo_storage_upload_ok` – přípony png/jpg/webp/pdf/docx/pptx/xlsx/csv, bez videa/audia, max 2 MB, max 20 souborů.
- `demo_guard_*` (RESTRICTIVE): blokují hlavně úpravy/mazání sdíleného seed obsahu (učebnice, lekce, listy, hry, prezentace, třídy, role, bannery, výjimky rozvrhu, žádosti o školu, preview studenti) a INSERT u `teacher_game_templates` (triggery s limity – bude ověřeno v kroku implementace). Trigger `demo_guard_profile` na `profiles`.
- **Nejsou** dnes limity: počet vlastních lekcí/listů/prezentací/úkolů, počet hráčů v živé hře, zprávy, tisk/export.
- `demo_contacts`: e-mail v čitelné podobě (nutné pro připomínky), mazání po úklidu (viz commit `b9dfb374`, SQL čeká na schválení).

## 1. Ochrana proti opakovanému zakládání dema

| Opatření | Co chrání | Co nechrání | GDPR | Velikost |
|---|---|---|---|---|
| A. **Návrat místo nového dema** – pokud prohlížeč má platný návratový kód, „Vyzkoušet zdarma" nabídne „Pokračovat v mém demu" (výchozí) a malý odkaz „Začít nové demo" | běžný opakovaný klik, omylem vytvořená dema, šetří kapacitu | anonymní okno, smazání úložiště, jiný prohlížeč | nic nového (kód už se ukládá) | **S**, jen frontend |
| B. **Denní/týdenní strop na hash IP**: např. 40/den a 100/týden, pro povolené akce (allowlist + datum platnosti) 150/den | skripty a „sériové" zakladatele z jedné sítě | mobilní data / VPN (mění IP) | jen hash IP, už se ukládá; mazat `demo_rate_events` po 30 dnech | **S** (kód v edge funkci, bez DB) |
| C. **Hash e-mailu** u zadaného kontaktu (`sha256(salt|lower(email))`) uložený odděleně v nové tabulce s TTL 90 dní; při zadání stejného e-mailu nabídnout „Pro tento e-mail už demo existuje – pokračovat / převést do ostrého účtu" | návrat k vlastnímu demu, upozornění opakovaného zneužití | lidi, kteří e-mail nezadají (je nepovinný) – slabá ochrana | nový osobní údaj (pseudonym); nutná zmínka v souhlasu v2 a lhůta; doporučuji **odložit** | **M**, DB změna |
| D. **AI per hash IP za den** (např. 30) vedle 5 na účet | obejití AI limitu založením nových dem | VPN | hash IP do `demo_ai_usage` | **S–M**, DB změna funkce `demo_ai_reserve` |
| E. Otisk zařízení (fingerprint) | – | – | vysoké riziko (cookie lišta, ePrivacy) | **nedoporučuji** |

Pozor na 28. 11.: 50 lidí na jedné IP. S `?akce=dalkove-ucitele` je limit 80/h – vyhoví. **Bez štítku** (lidé napíšou jen adresu) narazí po 20. Doporučení: na přednášce používat odkaz/QR se štítkem a do zavedení B nic nezpřísňovat. AI: 150/den globálně může při 50 lidech × 5 = 250 **vyčerpat** – doporučuji dočasně zvýšit `ai_daily_global` (jednořádkový UPDATE, ke schválení).

Co dělat s e-mailem, který už demo měl: nové demo nezakazovat (nepovinný e-mail by se obcházel), ale nabídnout návrat/převod. Tvrdý zákaz jen po zavedení C a schválení textu.

## 2. Omezení obsahu a funkcí v demu

| Oblast | Dnes | Návrh |
|---|---|---|
| Vlastní lekce / listy / prezentace / hry | hry mají insert guard, ostatní bez stropu | strop 20 každého typu (triggery přes `demo_config`) – **M**, DB |
| Soubory | 2 MB, 20 ks | ponechat |
| AI | 5 na účet, 150/den | ponechat 5; + per IP (1D) |
| Tisk / PDF export | bez omezení | ponechat plně (hlavní ukázka hodnoty), přidat vodoznak „Ukázka Bezli" – **S**, frontend |
| Živá hra | bez stropu hráčů | max 40 hráčů na hru v demu (kontrola v join funkci) – **S–M**, edge funkce |
| Zprávy | v rámci dvojice | ponechat jen uvnitř demo dvojice (izolace už je); externí příjemci zavřít (ověřit v implementaci) |
| Hodnocení, úkoly, třída | ukázková třída | ponechat plně – ukazuje hodnotu |
| Pozvánky žáků, kódy tříd, rodiče, e-maily | e-maily vypnuté | zavřít připojování reálných žáků do demo třídy (ověřit `find_student_by_code`/kódy) – **M** |
| Doba života | 14 dní nečinnosti + D−0 | ponechat |

Hodnoty se nastavují v `demo_config` (DB, jeden řádek) a allowlist akcí v `create-demo-session/index.ts`.

## 3. Režim „samostatný učitel zdarma s limity"

- **Zdarma**: Studio (aktivity, hry, listy, prezentace), živá hra s PINem pro žáky bez účtu, vlastní knihovna, tisk.
- **Limity (návrh)**: 50 uložených materiálů, 20 AI generování/měsíc, 200 MB úložiště, 40 hráčů na hru.
- **Jen školní licence**: třídy, žákovské účty, úkoly, hodnocení, zprávy, rodiče, rozvrh, učebnice školy.
- **Technicky nejmenší řešení**: sloupec `profiles.account_tier` (`school` výchozí, `free_teacher`) + tabulka `tier_limits` (klíč úrovně → limity), funkce `tier_reserve(user, kind)` volaná ze stejných míst jako `demo_ai_reserve`; školní účty mají `school` → žádné limity, chování beze změny. UI: skrytí školních sekcí podle úrovně.
- **Přechod z dema**: existující tok převodu práce (`demo_contacts`) rozšířit o „Pokračovat zdarma jako samostatný učitel" → registrace s `account_tier=free_teacher` a převodem obsahu.
- Velikost: **L** (DB, RLS pro třídy/úkoly podle úrovně, registrace, převod, testy). Po přednášce.

## Doporučené pořadí

Před 28. 11. (bez DB, kromě jednoho UPDATE):
1. 1A návrat do vlastního dema (S).
2. Ověřit QR/odkaz se štítkem `dalkove-ucitele`; případně dočasné okno platnosti štítku (S).
3. Ke schválení: `UPDATE demo_config SET ai_daily_global = 400;` na dobu akce (S).
4. Vodoznak u tisku dema (S) – volitelně.

Po přednášce: 1B, 1D, 2 (stropy obsahu, hráčů), pak 1C a 3.

## Rizika
- Zpřísnění IP limitů může zablokovat školní sítě (NAT) – proto výjimky akcí a měkké hlášky s odkazem „Vytvořit účet".
- Hash e-mailu = osobní údaj; vyžaduje schválený text souhlasu.
- Triggery stropů nesmí zasáhnout ostré účty – jen přes `is_demo_user()` / úroveň.

## Testy (při implementaci)
Návrat místo nového dema; limity IP s výjimkou akce (50 na jedné IP projde); AI per IP; stropy obsahu jen pro demo; školní účet bez limitů.

## Neověřitelné bez živého testu
Skutečná IP sítě na přednášce, chování Safari s mazáním úložiště, zátěž 50 současných dem.
