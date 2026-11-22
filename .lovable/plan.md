# Veřejný formulář / dotazník Bezli — analýza a návrh

Pouze návrh. Nic se neimplementuje, DB/RLS se nemění, nic se nenasazuje. Zařazeno za aktuální frontu editoru prezentací. Po schválení se plán archivuje do `.lovable/plan/verejny-formular-dotaznik-2026-11-22.md`.

## 1. Co existuje a co lze použít
- **Živá hra (/live, /hra)**: připojení PINem přes `join-game`, vydá 64znakový `join_token` platný **8 h**; relace končí stavem `finished`. Je vázaná na `game_sessions`/`game_players` a průběh řízený učitelem (otázka po otázce). **Pro trvalý odkaz se nehodí** — potřeba nový koncept (formulář bez průběhu, bez hráčů, bez časovače).
- **submit-activity-response**: vzor pro serverový zápis anonymní odpovědi; nemá vlastní omezení četnosti → použít jako vzor, ne přímo.
- **ActivityModel / ActivityEditor**: anketa, zeď, slovní mrak, otevřená odpověď mají editory voleb; lze převzít komponenty polí (volby, placeholdery, kontrast), ne celý model (chybí povinnost, škála, pořadí sekcí).
- **QR**: knihovny `qrcode` + `qrcode.react`, helper `src/lib/qr-inline.ts`, použití v projekci a pracovních listech → QR ke stažení i do slidu.
- **Export**: `exceljs` je v projektu → XLSX; CSV jednoduše v prohlížeči.
- **Omezení četnosti**: vzor `demo_rate_events` / `email_send_rate`.
- **Grafy výsledků**: vykreslení ankety v projekci lze převzít.

## 2. Datový model (návrh)
- `forms`: vlastník, škola (volitelně), název, úvodní text, `public_token` (32 B náhodně, base64url), stav (koncept/otevřeno/uzavřeno), `closes_at`, `max_responses`, `anonymous`, `collect_email` (volitelné), `consent_text`, `one_per_device`, štítek AI.
- `form_questions`: pořadí, typ (`single`, `multi`, `scale_1_5`, `short_text`, `long_text`, `yes_no`), text, nápověda, volby (JSON), povinná.
- `form_responses`: formulář, čas, volitelný e-mail, hash zařízení (sůl na formulář), **odpovědi jako JSONB** `{question_id: hodnota}` — jedna řada na odpověď, jednodušší export; samostatná `form_answers` není potřeba pro ~50–500 odpovědí.
- Podmíněné otázky ne.

## 3. Bezpečnost
- Anon nemá přímý SELECT/INSERT. Veřejná stránka čte přes edge funkci `public-form` (jen otevřený formulář podle tokenu, bez vlastníka), zápis přes `submit-form-response`.
- Server: validace typů, povinných polí, délek (krátký 200, dlouhý 3000 znaků, e-mail 255), uzávěrky a limitu (atomicky v SQL funkci).
- Rate limit: max 5 odeslání/10 min na IP-hash a formulář, globálně 2000/den/formulář.
- Spam: honeypot pole + minimální doba vyplnění (3 s). Turnstile jen jako pozdější volba (vyžaduje klíč).
- „Jedna odpověď na zařízení“: náhodné ID v localStorage + hash; pouze měkká ochrana (vysvětlit v UI).
- Odkaz neobsahuje ID ani osobní údaje, jen token; neplatný token = obecná chyba (bez rozlišení).
- Čtení výsledků: vlastník, školní admin své školy, admin.
- Demo: formulář lze vytvořit, ale veřejně otevřít jen s limitem 30 odpovědí, smaže se s párem; RESTRICTIVE `demo_guard_*`.
- GDPR: výchozí anonymní; při sběru e-mailu povinný souhlas, retence (např. 365 dní) přes `run_log_retention`.

## 4. UI
- **Navigace**: samostatně „Dotazníky“ v učitelské sekci (dlaždice na nástěnce), ne ve Studiu — Studio je pro živé hry.
- **Editor**: seznam otázek s přetahováním, typ, povinnost, náhled mobilu vedle; šablony „Předdotazník pro přednášku“ (zařízení, zdatnost 1–5, nástroje, co přinesete, očekávání) a „Zpětná vazba po akci“.
- **Sdílení**: odkaz `/f/<token>`, Kopírovat, QR (PNG/SVG ke stažení), „Vložit do prezentace“.
- **Respondent**: 390 px, jedna stránka, velké cíle, vykání, chybové hlášky u polí, WCAG 2.2 AA, poděkování.
- **Výsledky**: souhrn s grafy (volby, škála s průměrem), tabulka odpovědí, textové odpovědi, filtr podle otázky/odpovědi; Uzavřít/Otevřít; export CSV/XLSX.

## 5. Propojení s Bezli
- AI shrnutí textových odpovědí jako návrh se štítkem „AI generováno“ (bez e-mailů, model z `ai-models.ts`, demoAiGuard).
- Prezentace: nový prvek „QR dotazníku“ a „Výsledky dotazníku“ (snímek grafu v okamžiku vložení, nikoli živé čtení).

## 6. Etapy a odhad
1. SQL + edge funkce + veřejná stránka (2 dny)
2. Editor, šablony, sdílení, QR (2 dny)
3. Výsledky, export CSV/XLSX, uzavření (1,5 dne)
4. Později: AI shrnutí, vložení do prezentace, demo režim, Turnstile, retence

**Do 28. 11. 2026 reálně**: etapy 1–3 (pokud bude SQL schváleno do 24. 11.), demo účty dočasně bez veřejného otevření. Ostatní později.

**Rizika**: spam bez captchy; měkká ochrana „jedna odpověď“; termín závisí na schválení SQL; osobní údaje při sběru e-mailu.

## SQL návrh (NEAPLIKOVAT, ke schválení)
```sql
CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  intro text CHECK (char_length(intro) <= 3000),
  consent_text text CHECK (char_length(consent_text) <= 2000),
  public_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32),'base64'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed')),
  closes_at timestamptz,
  max_responses int CHECK (max_responses BETWEEN 1 AND 5000),
  anonymous boolean NOT NULL DEFAULT true,
  collect_email boolean NOT NULL DEFAULT false,
  one_per_device boolean NOT NULL DEFAULT true,
  ai_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.form_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  position int NOT NULL,
  kind text NOT NULL CHECK (kind IN ('single','multi','scale_1_5','short_text','long_text','yes_no')),
  prompt text NOT NULL CHECK (char_length(prompt) BETWEEN 1 AND 500),
  help text CHECK (char_length(help) <= 500),
  options jsonb NOT NULL DEFAULT '[]',
  required boolean NOT NULL DEFAULT false
);
CREATE TABLE public.form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  answers jsonb NOT NULL,
  email text CHECK (char_length(email) <= 255),
  device_hash text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX form_responses_device_uq ON public.form_responses(form_id, device_hash) WHERE device_hash IS NOT NULL;
CREATE TABLE public.form_rate_events (
  id bigserial PRIMARY KEY, form_id uuid NOT NULL, ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forms, public.form_questions TO authenticated;
GRANT SELECT, DELETE ON public.form_responses TO authenticated;
GRANT ALL ON public.forms, public.form_questions, public.form_responses, public.form_rate_events TO service_role;
GRANT USAGE ON SEQUENCE public.form_rate_events_id_seq TO service_role;

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_rate_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_form(_form uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM forms f WHERE f.id=_form AND (
    f.owner_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR (f.school_id IS NOT NULL AND public.has_role(auth.uid(),'school_admin')
        AND f.school_id = public.get_user_school_id(auth.uid()))))
$$;

CREATE POLICY forms_owner_all ON public.forms FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY forms_read ON public.forms FOR SELECT TO authenticated USING (public.can_read_form(id));
CREATE POLICY fq_owner_all ON public.form_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM forms f WHERE f.id=form_id AND f.owner_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM forms f WHERE f.id=form_id AND f.owner_id=auth.uid()));
CREATE POLICY fq_read ON public.form_questions FOR SELECT TO authenticated USING (public.can_read_form(form_id));
CREATE POLICY fr_read ON public.form_responses FOR SELECT TO authenticated USING (public.can_read_form(form_id));
CREATE POLICY fr_owner_delete ON public.form_responses FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM forms f WHERE f.id=form_id AND f.owner_id=auth.uid()));
-- form_rate_events: bez politik (jen service_role). Vkládání odpovědí jen edge funkcí
-- přes service-only funkci submit_form_response (zámek řádku formuláře, kontrola stavu,
-- uzávěrky, limitu). Demo: RESTRICTIVE demo_guard_* / demo_iso podle stávajícího vzoru.
```
