# Audit secretů – 2026-11-16 (pouze analýza)

Žádné změny kódu, DB ani secretů. Hodnoty nebyly čteny ani vypisovány. Po schválení se dokument archivuje do `.lovable/plan/` (cílový název: audit-secretu-2026-11-16).

## Výsledek

| Secret | Používá se? | Důkaz | Doporučení |
|---|---|---|---|
| RESEND_API_KEY | Ano | `send-email/index.ts:50`, `notify-email/index.ts:50`, `submit-feedback/index.ts:98`, `send-license-inquiry/index.ts:95` (záloha `RESEND_KEY` – v projektu neexistuje) | Nechat |
| DEMO_IP_SALT | Ano | `_shared/demo.ts:24` (hash IP pro demo limity) | Nechat |
| VAPID_PRIVATE_KEY | Ano | `send-push/index.ts:14,34-35`; veřejný pár je v `src/lib/pushConfig.ts` | Nechat (mění se jen spolu s veřejným klíčem) |
| VAPID_SUBJECT | Ano | `send-push/index.ts:22` (výchozí `mailto:noreply@bezli.cz`, pokud chybí) | Nechat (smazání by funkčně nevadilo, ale není důvod) |
| CRON_SECRET | **Nepoužívá se** | Žádné `Deno.env.get("CRON_SECRET")` v edge funkcích ani v klientu; jen komentář v migraci `20260614144849…sql:95` | Smazat je pravděpodobně bezpečné – viz níže |
| NOTIFY_PARENT_SECRET | **Nepoužívá se** | Žádný čtenář; `notify-parent/index.ts:59` a `notify-email/index.ts:57` čtou z trezoru `notify_parent_internal_secret` | Smazat (bezpečné) |
| SEND_PUSH_SECRET | **Nepoužívá se** | Žádný čtenář; `send-push/index.ts:103` čte z trezoru `send_push_internal_secret` | Smazat (bezpečné) |
| `lovable` (malým) | **Nepoužívá se** | Žádné `Deno.env.get("lovable")` ani jiná reference v edge funkcích, migracích ani klientu | Smazat (bezpečné) |
| LOVABLE_API_KEY | Ano | 40× `Deno.env.get("LOVABLE_API_KEY")` v AI funkcích (např. `edit-slide`, `ai-practice-rag`, `generate-*`) | Nechat (spravovaný, jen rotovat) |

## CRON_SECRET vs. `cron_internal_secret`

- `cron_internal_secret` je uložen v DB trezoru (vault, vytvořen 2026-07-17 migrací `20260717181843…sql`, náhodná hodnota). Edge funkce ho čtou přes `_shared/internal-secret.ts` → RPC `public.get_internal_secret` (`20260717181947…sql`, SECURITY DEFINER, jen service_role, povolené pouze tři názvy).
- Čtenáři: `publish-scheduled-assignments/lessons/worksheets`, `auto-reminders-job`, `reap-stale-jobs`, `detect-student-alerts`, `check-license-expiring-daily`, `demo-cleanup`, `staff-event-reminders`. Porovnávají ho s hlavičkou `X-Cron-Secret`.
- Projektový secret `CRON_SECRET` žádného čtenáře nemá – pochází ze starší verze (před přechodem na trezor).
- Plánované úlohy (pg_cron) podle migrací `20260614151518…` a `20260728085156…` posílají `X-Cron-Secret` jako **text vložený přímo v příkazu úlohy**, nikoli čtený z trezoru ani z `CRON_SECRET`. Smazání `CRON_SECRET` je tedy úlohy neovlivní.

## Neověřeno

- Aktuální obsah `cron.job` a definice DB funkcí obsahující tajemství nebylo možné číst (přístup k tajemstvím je agentovi blokován). Neověřil jsem, zda vložená hodnota hlavičky v úlohách odpovídá trezoru; pokud ne, úlohy dostávají 401 bez ohledu na `CRON_SECRET`. Doporučení: zkontrolovat logy `publish-scheduled-*` / `reap-stale-jobs` na odpovědi 401.
- Spouštěče `notify-parent` / `send-push` čtou z trezoru dle migrace `20260717181843…`; živé definice potvrzeny nebyly (stejný důvod).

## Doporučený postup mazání (až na váš pokyn)

1. Smazat `lovable`, `NOTIFY_PARENT_SECRET`, `SEND_PUSH_SECRET`.
2. Smazat `CRON_SECRET` po kontrole logů naplánovaných funkcí.
