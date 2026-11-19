# Poptávky licencí: uložení před e-mailem a sekce v administraci (finální návrh)

Aktualizace plánu `poptavky-licence-ulozeni-admin-2026-11-19.md` podle odpovědí Tyny. Nic se nespouští ani nenasazuje, dokud nepřijde „schvaluji“.

## Rozhodnutí Tyny
1. Uchování 24 měsíců, pak automatický úklid (spam po 30 dnech).
2. Upozornění jen na info@bezli.cz. Druhá adresa ani tabulka `admin_settings` nebude.
3. Povinné zaškrtávátko se souhlasem se zásadami zpracování osobních údajů. Ukládá se verze a čas souhlasu.
4. Poptávky vidí jen admin Bezli. Správci škol ne. Zapisuje jen edge funkce se service_role.
5. Zdroj poptávky je v poli `source`: `demo` / `form` / `license` / `other`.

## Ověřený stav
- Tabulka `license_inquiries` zatím neexistuje.
- Funkce `has_role` v databázi není. Admin se v projektu ověřuje přes `public.is_admin()` (SECURITY DEFINER, `user_roles.role = 'admin'`), proto ji SQL používá.
- Pro úklid je k dispozici pg_cron.
- Ostatní zjištění platí podle původního plánu: `send-license-inquiry` dnes nic neukládá, rate limit drží jen v paměti a volá ji jen `LicenseInquiryDialog`.

## Co se postaví
- **Formulář /licence:** povinné zaškrtávátko „Souhlasím se zpracováním osobních údajů podle zásad“ s odkazy na /gdpr a /podminky (do té doby jen informační věta s oběma odkazy, bez políčka). Bez zaškrtnutí nejde odeslat (kontroluje se i na serveru).
- **Funkce `send-license-inquiry`:**
  - nejdřív uloží poptávku, pak pošle e-mail na info@bezli.cz;
  - uživatel vždy dostane „Děkujeme, ozveme se“, i když e-mail selže;
  - zdroj `demo` jen pro ověřeného návštěvníka dema (pár dohledá server);
  - rate limit v databázi;
  - obsah poptávky se nikam neloguje.
- **Administrace → Poptávky** (jen admin):
  - seznam s filtry zdroj/stav/balíček, hledání, stránkování po 50, karty na 390 px;
  - detail s poznámkou a stavem, „Odeslat e-mail znovu“ a „Smazat osobní údaje“;
  - export CSV.
- **Úklid:** jednou týdně se smažou poptávky starší 24 měsíců a spam starší 30 dnů.

## Finální SQL (ke schválení, nespuštěno)
```sql
CREATE TABLE public.license_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'license' CHECK (kind IN ('license','demo_transfer')),
  source text NOT NULL DEFAULT 'form' CHECK (source IN ('demo','form','license','other')),
  source_detail text CHECK (char_length(source_detail) <= 80),
  name text, email text, phone text, organization text, role text, plan text, student_count text,
  message text CHECK (char_length(message) <= 5000),
  demo_pair_id uuid,                       -- bez FK, úklid dema poptávku nesmaže
  demo_summary jsonb,
  consent_version text NOT NULL,
  consent_at timestamptz NOT NULL,
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sent','failed')),
  email_error text CHECK (char_length(email_error) <= 40),   -- jen kód, např. 'HTTP 429'
  email_attempts int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  handled_status text NOT NULL DEFAULT 'new' CHECK (handled_status IN ('new','in_progress','done','spam')),
  handled_note text CHECK (char_length(handled_note) <= 2000),
  handled_at timestamptz,
  handled_by uuid,
  anonymized_at timestamptz,
  ip_hash text
);

REVOKE ALL ON public.license_inquiries FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.license_inquiries TO authenticated;
GRANT ALL ON public.license_inquiries TO service_role;

ALTER TABLE public.license_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads inquiries" ON public.license_inquiries
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admin updates inquiries" ON public.license_inquiries
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
-- INSERT/DELETE pro klienty žádné pravidlo = zakázáno; zapisuje jen service_role.

-- Admin smí měnit jen stav řešení a poznámku; osobní údaje, souhlas a zdroj nikdy.
CREATE OR REPLACE FUNCTION public.license_inquiries_guard_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    IF (NEW.kind, NEW.source, NEW.source_detail, NEW.name, NEW.email, NEW.phone, NEW.organization,
        NEW.role, NEW.plan, NEW.student_count, NEW.message, NEW.demo_pair_id, NEW.demo_summary,
        NEW.consent_version, NEW.consent_at, NEW.email_status, NEW.email_error, NEW.email_attempts,
        NEW.last_attempt_at, NEW.anonymized_at, NEW.ip_hash, NEW.created_at)
       IS DISTINCT FROM
       (OLD.kind, OLD.source, OLD.source_detail, OLD.name, OLD.email, OLD.phone, OLD.organization,
        OLD.role, OLD.plan, OLD.student_count, OLD.message, OLD.demo_pair_id, OLD.demo_summary,
        OLD.consent_version, OLD.consent_at, OLD.email_status, OLD.email_error, OLD.email_attempts,
        OLD.last_attempt_at, OLD.anonymized_at, OLD.ip_hash, OLD.created_at) THEN
      RAISE EXCEPTION 'Only handled_* fields can be changed' USING ERRCODE = '42501';
    END IF;
    NEW.handled_by := auth.uid();
    NEW.handled_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER license_inquiries_guard_update BEFORE UPDATE ON public.license_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.license_inquiries_guard_update();

CREATE INDEX license_inquiries_created_idx ON public.license_inquiries (created_at DESC);
CREATE INDEX license_inquiries_status_idx  ON public.license_inquiries (handled_status, created_at DESC);
CREATE INDEX license_inquiries_source_idx  ON public.license_inquiries (source, created_at DESC);
CREATE INDEX license_inquiries_email_pending_idx ON public.license_inquiries (email_status, last_attempt_at)
  WHERE email_status <> 'sent';
CREATE INDEX license_inquiries_ip_idx ON public.license_inquiries (ip_hash, created_at DESC);

-- „Smazat osobní údaje“ z administrace (výmaz na žádost), jen admin.
CREATE OR REPLACE FUNCTION public.admin_anonymize_license_inquiry(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.license_inquiries
     SET name = NULL, email = NULL, phone = NULL, message = NULL, handled_note = NULL,
         ip_hash = NULL, anonymized_at = now(), updated_at = now()
   WHERE id = _id;
  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id)
  VALUES (auth.uid(), 'license_inquiry_anonymized', 'license_inquiry', _id);
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_anonymize_license_inquiry(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_anonymize_license_inquiry(uuid) TO authenticated;

-- Retenční úklid: >24 měsíců vše, spam >30 dní.
CREATE OR REPLACE FUNCTION public.purge_old_license_inquiries()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.license_inquiries
   WHERE greatest(created_at, coalesce(handled_at, created_at)) < now() - interval '24 months'
      OR (handled_status = 'spam' AND created_at < now() - interval '30 days');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.purge_old_license_inquiries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_license_inquiries() TO service_role;

SELECT cron.schedule('license-inquiries-retention-weekly', '30 3 * * 0',
  $$SELECT public.purge_old_license_inquiries();$$);
```
Poznámky k SQL:
- Úklid je čisté SQL v databázi, takže nepotřebuje žádný tajný klíč ani volání funkce.
- Sloupce `audit_log` se před spuštěním ještě ověří. Pokud se liší, upraví se jen INSERT a SQL se ukáže znovu.
- Retenční `DELETE` s podmínkou WHERE maže jen poptávky, nic jiného.
- Rollback: `cron.unschedule('license-inquiries-retention-weekly')` a pak `DROP` triggeru, funkcí a tabulky. Smaže tím i uložené poptávky.

## Soubory
- Nové:
  - `src/lib/license-inquiry.ts` (zdroj, validace, text a verze souhlasu, CSV);
  - `src/components/admin/AdminInquiries.tsx`, `src/components/admin/InquiryDetailSheet.tsx`;
  - `supabase/functions/_shared/license-inquiry.ts` (whitelist zdrojů, validace souhlasu, text e-mailu);
  - `supabase/functions/resend-license-inquiry/index.ts` (jen admin).
- Upravené:
  - `supabase/functions/send-license-inquiry/index.ts` (INSERT před e-mailem, DB rate limit, souhlas, zdroj);
  - `src/components/LicenseInquiryDialog.tsx` (zaškrtávátko, zdroj);
  - `src/pages/Admin.tsx` + menu v `SiteHeader` (sekce Poptávky s odznakem nových);
  - `src/components/demo/DemoBanner.tsx` (odkaz `/licence?zdroj=demo`);
  - `AGENTS.md` (jedno pravidlo).

## Testy
- `src/test/license-inquiry.test.ts`:
  - bez souhlasu odmítnuto;
  - neznámý zdroj → `other`;
  - `demo` bez ověřeného páru → `form`;
  - CSV s BOM a ochranou proti vzorcům.
- `src/test/license-inquiry-function.test.ts` (mock):
  - zápis proběhne před Resendem;
  - 429/5xx/chybějící klíč → failed + kód a uživatel dostane 200;
  - honeypot nic neuloží;
  - limit vrátí 429.
- Živě s `[TEST]` řádky (po schválení):
  - anon, žák, učitel a správce školy nic nevidí; admin vidí;
  - admin nezmění e-mail ani souhlas, jen stav a poznámku;
  - klient nesmí INSERT ani DELETE;
  - úklid smaže řádek se starým datem a spam starší 30 dnů; nový řádek zůstane.
- Celá sada, typy a build (7 starých selhání se nepočítá). Mobil 390 px: formulář i seznam.

## Neověřitelné bez nasazení
Skutečné doručení na info@bezli.cz a první běh týdenního úklidu.
