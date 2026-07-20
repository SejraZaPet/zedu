
-- 1. TABLE
CREATE TABLE public.landing_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index integer NOT NULL,
  section_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT landing_sections_type_chk CHECK (
    section_type IN ('hero','social_proof','features_grid','how_it_works','for_whom','platform_showcase','podcast','final_cta')
  )
);

CREATE INDEX landing_sections_order_idx ON public.landing_sections (order_index);
CREATE INDEX landing_sections_enabled_idx ON public.landing_sections (enabled) WHERE enabled = true;

-- 2. GRANTS
GRANT SELECT ON public.landing_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_sections TO authenticated;
GRANT ALL ON public.landing_sections TO service_role;

-- 3. RLS
ALTER TABLE public.landing_sections ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES
CREATE POLICY "Landing sections are readable by everyone"
  ON public.landing_sections FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert landing sections"
  ON public.landing_sections FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update landing sections"
  ON public.landing_sections FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can delete landing sections"
  ON public.landing_sections FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 5. updated_at trigger (reuse existing helper)
CREATE TRIGGER landing_sections_updated_at
  BEFORE UPDATE ON public.landing_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. SEED – 8 sections
INSERT INTO public.landing_sections (order_index, section_type, enabled, props) VALUES
(10, 'hero', true, jsonb_build_object(
  'title_parts', jsonb_build_array('Tvoř','Uč','Objevuj'),
  'subtitle', 'Kompletní platforma pro moderní výuku. Učebnice, živé hry, rozvrh a AI — vše na jednom místě.',
  'primary_cta', jsonb_build_object('label','Vyzkoušet zdarma','href','/auth','icon','Rocket'),
  'secondary_cta', jsonb_build_object('label','Jak to funguje ↓','scroll_to','jak-to-funguje','icon','Play'),
  'disclaimer', 'Zdarma pro všechny učitele. Bez platební karty.',
  'background_image_url', '',
  'logo_image_url', '',
  'features', jsonb_build_array(
    jsonb_build_object('icon','BookOpen','title','Digitální učebnice','description','Vytvářejte kapitoly, výukový obsah a strukturované materiály.','href',null),
    jsonb_build_object('icon','Sparkles','title','Interaktivní aktivity','description','Přidávejte kvízy, procvičování a interaktivní prvky.','href','/aktivity'),
    jsonb_build_object('icon','GraduationCap','title','Pro žáky','description','Procvičujte učivo, řešte interaktivní úkoly a sledujte svůj pokrok.','href',null)
  )
)),
(20, 'social_proof', true, jsonb_build_object(
  'metrics', jsonb_build_array(
    jsonb_build_object('icon','Layout','value','56','label','stránek v aplikaci'),
    jsonb_build_object('icon','Code','value','22 000+','label','řádků kódu'),
    jsonb_build_object('icon','Users','value','4','label','role uživatelů'),
    jsonb_build_object('icon','Gift','value','100%','label','zdarma v betě')
  ),
  'badges', jsonb_build_array(
    '🇨🇿 Vytvořeno v České republice',
    '🔒 GDPR ready',
    '⚡ React + Supabase'
  )
)),
(30, 'features_grid', true, jsonb_build_object(
  'title', 'Co ZEdu umí',
  'subtitle', 'Vše co potřebujete pro moderní výuku, na jednom místě.',
  'features', jsonb_build_array(
    jsonb_build_object('icon','BookOpen','title','Digitální učebnice','description','Blokový editor s 13 typy aktivit. Vytvořte kapitoly, lekce a interaktivní obsah.'),
    jsonb_build_object('icon','Gamepad2','title','Živé hry a kvízy','description','4 herní módy, 8 témat. Závod, stavění věže, krádež bodů — vše v reálném čase.'),
    jsonb_build_object('icon','Calendar','title','Rozvrh a plánování','description','Rozvrh s lichým/sudým týdnem. Plány hodin s AI asistentem a PDF exportem.'),
    jsonb_build_object('icon','Brain','title','AI asistent','description','AI generuje otázky, plány hodin i studijní materiály. Import PDF, DOCX a PPTX.'),
    jsonb_build_object('icon','Trophy','title','Gamifikace','description','XP body, 12 avatarů, 8 odznaků a leaderboard třídy. Žáky to baví.'),
    jsonb_build_object('icon','Heart','title','Pro rodiče','description','Dashboard s rozvrhem dítěte, pokrokem a komunikací s učitelem.')
  )
)),
(40, 'how_it_works', true, jsonb_build_object(
  'title', 'Jak začít?',
  'subtitle', '3 jednoduché kroky a můžete učit moderně.',
  'anchor_id', 'jak-to-funguje',
  'steps', jsonb_build_array(
    jsonb_build_object('n',1,'title','Zaregistrujte se','desc','30 sekund, bez platební karty. Stačí email.'),
    jsonb_build_object('n',2,'title','Vytvořte obsah','desc','Použijte blokový editor nebo importujte existující materiály.'),
    jsonb_build_object('n',3,'title','Učte moderně','desc','Sdílejte se žáky, spouštějte hry a sledujte pokrok.')
  ),
  'cta', jsonb_build_object('label','Začít zdarma','href','/auth')
)),
(50, 'for_whom', true, jsonb_build_object(
  'title', 'Pro koho je ZEdu?',
  'subtitle', 'Platforma pro celou školu.',
  'cards', jsonb_build_array(
    jsonb_build_object(
      'icon','UserRound',
      'title','Pro učitele',
      'bullets', jsonb_build_array('Blokový editor učebnic','Plány hodin s AI asistentem','Živé hry a kvízy','Rozvrh a kalendář','Export do PDF a Excel'),
      'cta','Začít jako učitel →',
      'to','/auth?role=teacher'
    ),
    jsonb_build_object(
      'icon','Backpack',
      'title','Pro žáky',
      'bullets', jsonb_build_array('Procvičování z lekce s AI','8 studijních metod','XP body a odznaky','PIN přihlášení','Upload příloh k úkolům'),
      'cta','Začít jako žák →',
      'to','/auth?role=student'
    ),
    jsonb_build_object(
      'icon','Heart',
      'title','Pro rodiče',
      'bullets', jsonb_build_array('Dashboard s přehledem dítěte','Rozvrh a pokrok','Zprávy učiteli','Email notifikace'),
      'cta','Začít jako rodič →',
      'to','/auth?role=rodic'
    )
  )
)),
(60, 'platform_showcase', true, jsonb_build_object(
  'title', 'Podívejte se dovnitř',
  'subtitle', 'Jak ZEdu vypadá v praxi.',
  'tabs', jsonb_build_array(
    jsonb_build_object('label','Editor učebnice','image_url',''),
    jsonb_build_object('label','Živá hra','image_url',''),
    jsonb_build_object('label','Rozvrh','image_url',''),
    jsonb_build_object('label','Dashboard žáka','image_url','')
  )
)),
(70, 'podcast', true, jsonb_build_object(
  'eyebrow', 'Podcast',
  'title', 'Rozhovory & epizody',
  'limit', 5
)),
(80, 'final_cta', true, jsonb_build_object(
  'title', 'Připraveni učit moderně?',
  'subtitle', 'Zaregistrujte se zdarma a začněte tvořit.',
  'primary_cta', jsonb_build_object('label','Vytvořit účet zdarma','href','/auth','icon','Rocket'),
  'secondary_link', jsonb_build_object('label','Zobrazit ceník','href','/cenik'),
  'contact_email', 'info@zedu.cz'
));
