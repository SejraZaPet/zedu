-- Catalog of study methods
CREATE TABLE public.study_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  steps_json JSONB DEFAULT '[]'::jsonb,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view study methods"
ON public.study_methods FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage study methods"
ON public.study_methods FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Student preferred methods
CREATE TABLE public.student_preferred_methods (
  student_id UUID NOT NULL,
  method_id UUID NOT NULL REFERENCES public.study_methods(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, method_id)
);

CREATE INDEX idx_student_preferred_methods_method ON public.student_preferred_methods(method_id);

ALTER TABLE public.student_preferred_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own preferred methods"
ON public.student_preferred_methods FOR ALL
TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- Student practice sessions
CREATE TABLE public.student_practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  method_id UUID NOT NULL REFERENCES public.study_methods(id) ON DELETE CASCADE,
  lesson_id UUID NULL,
  duration_min INT,
  score INT,
  answers_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_practice_sessions_student ON public.student_practice_sessions(student_id);
CREATE INDEX idx_practice_sessions_method ON public.student_practice_sessions(method_id);
CREATE INDEX idx_practice_sessions_lesson ON public.student_practice_sessions(lesson_id);

ALTER TABLE public.student_practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view their own practice sessions"
ON public.student_practice_sessions FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Students insert their own practice sessions"
ON public.student_practice_sessions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students delete their own practice sessions"
ON public.student_practice_sessions FOR DELETE
TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Teachers view sessions of their class students"
ON public.student_practice_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.class_members cm
    JOIN public.class_teachers ct ON ct.class_id = cm.class_id
    WHERE cm.user_id = student_practice_sessions.student_id
      AND ct.user_id = auth.uid()
  )
);

CREATE POLICY "Admins view all practice sessions"
ON public.student_practice_sessions FOR SELECT
TO authenticated
USING (public.is_admin());

-- Seed 8 study methods
INSERT INTO public.study_methods (name, slug, description, icon, steps_json) VALUES
('NEANA', 'neana', 'Pětifázová metoda učení: Náhled, Eseje (otázky), Aktivní čtení, Notace, Aplikace.', 'Brain',
 '[{"name":"Náhled","description":"Prolétni text, podívej se na nadpisy, obrázky a shrnutí."},
   {"name":"Eseje (otázky)","description":"Z nadpisů vytvoř otázky, na které budeš hledat odpovědi."},
   {"name":"Aktivní čtení","description":"Čti pozorně a hledej odpovědi na své otázky."},
   {"name":"Notace","description":"Zapiš si vlastními slovy klíčové myšlenky a odpovědi."},
   {"name":"Aplikace","description":"Použij naučené v příkladu, kvízu nebo vysvětli někomu jinému."}]'::jsonb),

('PQRST', 'pqrst', 'Klasická pětifázová metoda učení z textu: Preview, Question, Read, Summary, Test.', 'BookOpen',
 '[{"name":"Preview","description":"Prohlédni si strukturu textu, nadpisy a shrnutí."},
   {"name":"Question","description":"Zformuluj otázky, které tě k tématu napadají."},
   {"name":"Read","description":"Přečti text aktivně a hledej odpovědi."},
   {"name":"Summary","description":"Shrň hlavní myšlenky vlastními slovy."},
   {"name":"Test","description":"Otestuj se z otázek bez nahlížení do textu."}]'::jsonb),

('5P', '5p', 'Pět kroků pro efektivní zapamatování: Prolistuj, Ptej se, Přečti, Pověz, Prověř.', 'ListChecks',
 '[{"name":"Prolistuj","description":"Rychle prolistuj učivo a získej přehled."},
   {"name":"Ptej se","description":"Polož si k tématu konkrétní otázky."},
   {"name":"Přečti","description":"Přečti text důkladně a soustředěně."},
   {"name":"Pověz","description":"Převyprávěj obsah vlastními slovy nahlas."},
   {"name":"Prověř","description":"Vrať se k textu a zkontroluj, co ti uniklo."}]'::jsonb),

('Akrostika', 'akrostika', 'Mnemotechnická pomůcka: z prvních písmen pojmů vytvoříš snadno zapamatovatelnou větu nebo slovo.', 'Sparkles',
 '[{"name":"Vyber pojmy","description":"Vyber pojmy nebo položky, které si chceš zapamatovat ve správném pořadí."},
   {"name":"Vezmi první písmena","description":"Z každého pojmu vezmi první písmeno."},
   {"name":"Sestav větu","description":"Z těchto písmen sestav zábavnou větu nebo slovo."},
   {"name":"Opakuj","description":"Větu si několikrát zopakuj — pomůže ti vybavit původní pojmy."}]'::jsonb),

('Loci', 'loci', 'Metoda paměťových míst: pojmy si představuješ rozmístěné na známých místech (např. ve svém pokoji).', 'MapPin',
 '[{"name":"Vyber trasu","description":"Zvol si známé prostředí a vytvoř v něm jasnou trasu (např. byt, cesta do školy)."},
   {"name":"Přiřaď pojmy","description":"Každý pojem postupně umísti na konkrétní místo na trase."},
   {"name":"Vytvoř obraz","description":"K přiřazení použij silný, neobvyklý vizuální obraz."},
   {"name":"Procházej trasu","description":"V duchu projdi trasu a vybavuj si jednotlivé pojmy."}]'::jsonb),

('Pomodoro', 'pomodoro', 'Technika řízení času: 25 minut soustředěné práce + 5 minut přestávky. Po 4 cyklech delší pauza.', 'Timer',
 '[{"name":"Vyber úkol","description":"Zvol si jeden konkrétní úkol, na který se zaměříš."},
   {"name":"Nastav 25 minut","description":"Spusť časovač a soustřeď se bez vyrušení."},
   {"name":"5 minut přestávka","description":"Vstaň, protáhni se, odpočiň si od obrazovky."},
   {"name":"Opakuj 4×","description":"Po čtyřech cyklech si dej delší přestávku 15–30 minut."}]'::jsonb),

('SQ4R', 'sq4r', 'Rozšířená studijní metoda: Survey, Question, Read, Recite, wRite, Review.', 'NotebookPen',
 '[{"name":"Survey","description":"Prohlédni si text — nadpisy, obrázky, shrnutí."},
   {"name":"Question","description":"Vytvoř si otázky, na které chceš najít odpovědi."},
   {"name":"Read","description":"Aktivně čti a hledej odpovědi."},
   {"name":"Recite","description":"Vlastními slovy převyprávěj obsah nahlas."},
   {"name":"wRite","description":"Sepiš si poznámky a klíčové myšlenky."},
   {"name":"Review","description":"Po čase se k poznámkám vrať a zopakuj si je."}]'::jsonb),

('Sekvenční', 'sekvencni', 'Sekvenční čtení: učivo si rozdělíš na menší části a postupně je zvládáš jednu po druhé.', 'ArrowRightCircle',
 '[{"name":"Rozděl učivo","description":"Rozděl text na logické menší části (odstavce, kapitoly)."},
   {"name":"Zpracuj první část","description":"Přečti první část a udělej si poznámky."},
   {"name":"Ověř porozumění","description":"Shrň ji vlastními slovy, než přejdeš dál."},
   {"name":"Pokračuj postupně","description":"Stejně zpracuj další části jednu po druhé."},
   {"name":"Spoj části dohromady","description":"Nakonec spoj jednotlivé části do celkového obrazu."}]'::jsonb);