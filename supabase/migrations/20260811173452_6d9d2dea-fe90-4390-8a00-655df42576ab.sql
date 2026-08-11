CREATE TABLE public.staff_knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  category text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_knowledge_articles TO authenticated;
GRANT ALL ON public.staff_knowledge_articles TO service_role;

ALTER TABLE public.staff_knowledge_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and admins can read internal articles"
ON public.staff_knowledge_articles FOR SELECT TO authenticated
USING (public.is_admin() OR public.is_active_staff(auth.uid()));

CREATE POLICY "Admins can insert internal articles"
ON public.staff_knowledge_articles FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update internal articles"
ON public.staff_knowledge_articles FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete internal articles"
ON public.staff_knowledge_articles FOR DELETE TO authenticated
USING (public.is_admin());

CREATE TRIGGER update_staff_knowledge_articles_updated_at
BEFORE UPDATE ON public.staff_knowledge_articles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.staff_knowledge_articles (title, category, content) VALUES (
'Jak zadávat organizace a kontakty do CRM',
'CRM',
'## 1. Přidat novou organizaci

V CRM klikni "+ Nová organizace". Vyplň **název**, **typ** (škola/lektor/jiná), **stav** (Nový → Kontaktováno → V jednání → Zkušební → Zákazník), **kraj** a **odkud kontakt přišel** (doporučení, web, konference...).

## 2. Přidat kontaktní osobu k organizaci

V detailu organizace klikni "+ Přidat kontakt". Vyplň:

- **jméno**
- **pozici**
- **kategorii** (Vedení/Učitel/Jiné - důležité pro filtrování hromadných e-mailů)
- **e-mail**
- **telefon**

## 3. Zapsat historii jednání / poznámku

V "Historii komunikace" klikni "+ Přidat záznam". Volitelně vyber konkrétní kontaktní osobu (nebo nech prázdné pro obecnou poznámku k celé organizaci). Zápis je vždy jen **datum · tvoje zkratka · krátký text**.

Rozklikneš-li konkrétní kontakt, uvidíš posledních 5 poznámek jen k němu, s tlačítkem "Zobrazit celou historii" na kompletní časovou osu organizace.

## 4. Naplánovat úkol / připomínku

Klikni "+ Přidat úkol" - zadej **název**, **termín** a **prioritu**. Úkol se rovnou objeví ve tvém Mém panelu (Moje úkoly i kalendář).

Když úkol později otevřeš v Mém panelu, nahoře uvidíš klikací odznak 🏢 organizace (nebo 👤 osoby) - jedno kliknutí tě přenese rovnou na jejich detail v CRM.'
);