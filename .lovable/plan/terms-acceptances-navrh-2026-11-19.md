# Návrh: doklad o souhlasu s obchodními podmínkami (NESPUŠTĚNO, čeká na „schvaluji“)

Do schválení se verze a čas souhlasu ukládají do registračních údajů účtu (`terms_version`, `terms_accepted_at`).
Po schválení se tabulka vytvoří, existující souhlasy se přenesou z registračních údajů a registrace bude po přihlášení zapisovat řádek.

```sql
CREATE TABLE public.terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  terms_version text NOT NULL CHECK (char_length(terms_version) <= 20),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, terms_version)
);
CREATE INDEX terms_acceptances_user_idx ON public.terms_acceptances (user_id, accepted_at DESC);

REVOKE ALL ON public.terms_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.terms_acceptances TO authenticated;
GRANT ALL ON public.terms_acceptances TO service_role;

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own acceptance insert" ON public.terms_acceptances
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND accepted_at <= now() + interval '1 minute');
CREATE POLICY "Own acceptance read" ON public.terms_acceptances
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admin reads acceptances" ON public.terms_acceptances
  FOR SELECT TO authenticated USING (public.is_admin());
-- Žádné UPDATE/DELETE pravidlo = uživatel nesmí měnit ani mazat.
```
Rollback: `DROP TABLE public.terms_acceptances;`.
Pozn.: demo uživatelé mají zápisy omezené RESTRICTIVE pravidly `demo_guard_*`; registrace v demu neprobíhá, tabulku proto není nutné přidávat do demo výjimek.
