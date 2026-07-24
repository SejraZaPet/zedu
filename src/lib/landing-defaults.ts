// Default props for each landing section type. Used as a fallback when the
// DB row is missing (protects against an empty page during migrations) and
// as the initial value when an admin adds a new section.

export const DEFAULT_HERO_PROPS = {
  title_parts: ["Tvoř", "Uč", "Objevuj"],
  subtitle:
    "Kompletní platforma pro moderní výuku. Učebnice, živé hry, rozvrh a AI — vše na jednom místě.",
  disclaimer: "Zdarma pro všechny učitele. Bez platební karty.",
  background_image_url: "",
  logo_image_url: "",
  primary_cta: { label: "Vyzkoušet zdarma", href: "/auth", icon: "Rocket" },
  secondary_cta: { label: "Jak to funguje ↓", scroll_to: "jak-to-funguje", icon: "Play" },
  features: [
    { icon: "BookOpen", title: "Digitální učebnice", description: "Vytvářejte kapitoly, výukový obsah a strukturované materiály.", href: null as string | null },
    { icon: "Sparkles", title: "Interaktivní aktivity", description: "Přidávejte kvízy, procvičování a interaktivní prvky.", href: "/aktivity" },
    { icon: "GraduationCap", title: "Pro žáky", description: "Procvičujte učivo, řešte interaktivní úkoly a sledujte svůj pokrok.", href: null as string | null },
  ],
};

export const DEFAULT_SOCIAL_PROOF_PROPS = {
  metrics: [
    { icon: "Layers", value: "12+", label: "typů interaktivních aktivit" },
    { icon: "Presentation", value: "Živě", label: "prezentace i domácí procvičování" },
    { icon: "Users", value: "4", label: "propojené role" },
    { icon: "Gift", value: "100%", label: "zdarma v betě" },
  ],
  badges: [
    "🇨🇿 Vytvořeno v České republice",
    "🔒 GDPR ready",
    "⚡ React + Supabase",
  ],
};

export const DEFAULT_FEATURES_GRID_PROPS = {
  title: "Co ZEdu umí",
  subtitle: "Vše co potřebujete pro moderní výuku, na jednom místě.",
  features: [
    { icon: "BookOpen", title: "Digitální učebnice", description: "Blokový editor s 13 typy aktivit. Vytvořte kapitoly, lekce a interaktivní obsah." },
    { icon: "Gamepad2", title: "Živé hry a kvízy", description: "4 herní módy, 8 témat. Závod, stavění věže, krádež bodů — vše v reálném čase." },
    { icon: "Calendar", title: "Rozvrh a plánování", description: "Rozvrh s lichým/sudým týdnem. Plány hodin s AI asistentem a PDF exportem." },
    { icon: "Brain", title: "AI asistent", description: "AI generuje otázky, plány hodin i studijní materiály. Import PDF, DOCX a PPTX." },
    { icon: "Trophy", title: "Gamifikace", description: "XP body, 12 avatarů, 8 odznaků a leaderboard třídy. Žáky to baví." },
    { icon: "Heart", title: "Pro rodiče", description: "Dashboard s rozvrhem dítěte, pokrokem a komunikací s učitelem." },
  ],
};

export const DEFAULT_HOW_IT_WORKS_PROPS = {
  title: "Jak začít?",
  subtitle: "3 jednoduché kroky a můžete učit moderně.",
  anchor_id: "jak-to-funguje",
  steps: [
    { n: 1, title: "Zaregistrujte se", desc: "30 sekund, bez platební karty. Stačí email." },
    { n: 2, title: "Vytvořte obsah", desc: "Použijte blokový editor nebo importujte existující materiály." },
    { n: 3, title: "Učte moderně", desc: "Sdílejte se žáky, spouštějte hry a sledujte pokrok." },
  ],
  cta: { label: "Začít zdarma", href: "/auth" },
};

export const DEFAULT_FOR_WHOM_PROPS = {
  title: "Pro koho je ZEdu?",
  subtitle: "Platforma pro celou školu.",
  cards: [
    {
      icon: "UserRound",
      title: "Pro učitele",
      bullets: ["Blokový editor učebnic", "Plány hodin s AI asistentem", "Živé hry a kvízy", "Rozvrh a kalendář", "Export do PDF a Excel"],
      cta: "Začít jako učitel →",
      to: "/auth?role=teacher",
    },
    {
      icon: "Backpack",
      title: "Pro žáky",
      bullets: ["Procvičování z lekce s AI", "8 studijních metod", "XP body a odznaky", "PIN přihlášení", "Upload příloh k úkolům"],
      cta: "Začít jako žák →",
      to: "/auth?role=student",
    },
    {
      icon: "Heart",
      title: "Pro rodiče",
      bullets: ["Dashboard s přehledem dítěte", "Rozvrh a pokrok", "Zprávy učiteli", "Email notifikace"],
      cta: "Začít jako rodič →",
      to: "/auth?role=rodic",
    },
  ],
};

export const DEFAULT_PLATFORM_SHOWCASE_PROPS = {
  title: "Podívejte se dovnitř",
  subtitle: "Jak ZEdu vypadá v praxi.",
  tabs: [
    { label: "Editor učebnice", image_url: "" },
    { label: "Živá hra", image_url: "" },
    { label: "Rozvrh", image_url: "" },
    { label: "Dashboard žáka", image_url: "" },
  ],
};

export const DEFAULT_PODCAST_PROPS = {
  eyebrow: "Podcast",
  title: "Rozhovory & epizody",
  limit: 5,
};

export const DEFAULT_FINAL_CTA_PROPS = {
  title: "Připraveni učit moderně?",
  subtitle: "Zaregistrujte se zdarma a začněte tvořit.",
  primary_cta: { label: "Vytvořit účet zdarma", href: "/auth", icon: "Rocket" },
  secondary_link: { label: "Zobrazit ceník", href: "/cenik" },
  contact_email: "info@zedu.cz",
};

export const DEFAULT_PROPS_BY_TYPE: Record<string, Record<string, any>> = {
  hero: DEFAULT_HERO_PROPS,
  social_proof: DEFAULT_SOCIAL_PROOF_PROPS,
  features_grid: DEFAULT_FEATURES_GRID_PROPS,
  how_it_works: DEFAULT_HOW_IT_WORKS_PROPS,
  for_whom: DEFAULT_FOR_WHOM_PROPS,
  platform_showcase: DEFAULT_PLATFORM_SHOWCASE_PROPS,
  podcast: DEFAULT_PODCAST_PROPS,
  final_cta: DEFAULT_FINAL_CTA_PROPS,
};

/** Shallow-merge DB props onto defaults; DB fields override defaults. */
export function mergeSectionProps<T extends Record<string, any>>(defaults: T, incoming?: Record<string, any> | null): T {
  if (!incoming) return defaults;
  return { ...defaults, ...incoming } as T;
}
