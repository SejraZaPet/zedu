/**
 * WCAG 2.2 AA Checklist — ZEdu Platform
 *
 * Practical dev+QA checklist for key user flows.
 * Generated 2026-03-15.
 */

export const WCAG_CHECKLIST = {
  wcagChecklist: [
    // ─── JOIN FLOW (kód / QR) ───
    {
      area: "Join flow – kód hry",
      test: "1.3.1 Info and Relationships – input má viditelný <label>",
      how: "Inspect: <Input> pro kód hry a přezdívku mají asociovaný <label> nebo aria-label.",
      acceptance: "Screen reader (NVDA/VoiceOver) přečte účel pole před fokusem.",
    },
    {
      area: "Join flow – kód hry",
      test: "2.1.1 Keyboard – celý flow ovladatelný klávesnicí",
      how: "Tab přes pole kódu → přezdívka → tlačítko Připojit se. Enter odešle.",
      acceptance: "Uživatel se připojí do hry bez myši.",
    },
    {
      area: "Join flow – kód hry",
      test: "1.4.3 Contrast (Minimum) – text kódu vs. pozadí",
      how: "DevTools / axe: mono font kódu (text-primary na bg-card) ≥ 4.5:1.",
      acceptance: "Contrast ratio ≥ 4.5:1 pro normální text, ≥ 3:1 pro velký text (≥18pt).",
    },
    {
      area: "Join flow – kód hry",
      test: "3.3.1 Error Identification – chybový stav při špatném kódu",
      how: "Zadat neexistující kód → toast 'Hra s tímto kódem neexistuje'.",
      acceptance: "Chyba je oznámena textem (ne jen barvou), screen reader ji přečte (role=alert nebo aria-live).",
    },
    {
      area: "Join flow – kód hry",
      test: "2.4.7 Focus Visible – viditelný focus ring",
      how: "Tab přes všechny interaktivní prvky, sledovat focus outline.",
      acceptance: "Každý focusovatelný prvek má viditelný ring s kontrastem ≥ 3:1 vůči pozadí.",
    },
    {
      area: "Join flow – QR kód",
      test: "1.1.1 Non-text Content – QR má textovou alternativu",
      how: "QR <img> nebo <canvas> má alt='QR kód pro připojení – kód XXXX' nebo aria-label.",
      acceptance: "Screen reader oznámí kód hry i bez vizuálního QR.",
    },
    {
      area: "Join flow – QR kód",
      test: "1.4.11 Non-text Contrast – QR čitelný",
      how: "QR moduly (černá) vs. pozadí (bílá): kontrola kontrastním nástrojem.",
      acceptance: "Kontrast QR modulů ≥ 3:1 (typicky je ~21:1).",
    },

    // ─── LIVE DASHBOARD (grafy) ───
    {
      area: "Live dashboard – grafy",
      test: "1.1.1 Non-text Content – grafy mají textovou alternativu",
      how: "Každý <svg> graf má role='img' + aria-label popisující trend, nebo data tabulku.",
      acceptance: "Screen reader přečte smysluplný souhrn dat (např. '8 z 12 žáků odpovědělo správně').",
    },
    {
      area: "Live dashboard – grafy",
      test: "1.4.1 Use of Color – data rozlišená i bez barvy",
      how: "Zobrazit graf v šedotónu (CSS filter: grayscale(1)). Rozliší se série?",
      acceptance: "Každá série má pattern, label nebo tvar navíc k barvě.",
    },
    {
      area: "Live dashboard – grafy",
      test: "1.4.11 Non-text Contrast – grafické prvky",
      how: "Kontrastní poměr čar/sloupců vůči pozadí ≥ 3:1.",
      acceptance: "Všechny datové prvky splňují 3:1.",
    },
    {
      area: "Live dashboard – žebříček",
      test: "1.3.1 Info and Relationships – tabulka žebříčku",
      how: "Leaderboard používá <table> s <th> nebo role='table' + role='row'.",
      acceptance: "Screen reader ohlásí záhlaví sloupců (Pořadí, Jméno, Skóre).",
    },
    {
      area: "Live dashboard – realtime updates",
      test: "4.1.3 Status Messages – dynamické změny",
      how: "Přidání hráče / změna skóre → aria-live='polite' region.",
      acceptance: "Screen reader oznámí nového hráče bez přesunu fokusu.",
    },

    // ─── MATCHING / HOTSPOT (alternativa bez drag) ───
    {
      area: "Matching activity",
      test: "2.1.1 Keyboard – matching bez drag-and-drop",
      how: "Matching používá <select> dropdown místo DnD. Tab → výběr → Enter.",
      acceptance: "Celé párování zvládnutelné pouze klávesnicí.",
    },
    {
      area: "Matching activity",
      test: "4.1.2 Name, Role, Value – select má label",
      how: "Každý <select> má aria-label='Přiřaď k: [pojem]' nebo viditelný <label>.",
      acceptance: "Screen reader přečte 'Přiřaď k: fotosyntéza, combobox'.",
    },
    {
      area: "Hotspot activity",
      test: "2.1.1 Keyboard – hotspot bez klikání na obrázek",
      how: "Hotspoty mají klávesovou alternativu: seznam tlačítek nebo Tab-fokusovatelné oblasti.",
      acceptance: "Uživatel vybere oblast klávesnicí (Tab + Enter).",
    },
    {
      area: "Hotspot activity",
      test: "1.1.1 Non-text Content – obrázek s hotspoty",
      how: "Obrázek má alt popisující kontext. Každý hotspot má aria-label s popisem oblasti.",
      acceptance: "Screen reader přečte 'Oblast 1: levá komora srdce'.",
    },
    {
      area: "Hotspot activity",
      test: "2.5.1 Pointer Gestures – žádný multi-touch požadavek",
      how: "Ověřit, že hotspot reaguje na single tap/click, ne pinch/swipe.",
      acceptance: "Všechny akce proveditelné jedním kliknutím/tapem.",
    },

    // ─── EXPORT WIZARD ───
    {
      area: "Export wizard",
      test: "2.4.3 Focus Order – logické pořadí v modálu",
      how: "Otevřít export dialog → Tab. Pořadí: formát → cíl → papír → tlačítko Export.",
      acceptance: "Focus se nepřesouvá mimo modál (focus trap). Esc zavře.",
    },
    {
      area: "Export wizard",
      test: "1.3.1 Info and Relationships – radio/select mají fieldset+legend",
      how: "Skupina radio buttonů 'Formát' obalena <fieldset><legend>Formát exportu</legend>.",
      acceptance: "Screen reader přečte skupinu i vybranou hodnotu.",
    },
    {
      area: "Export wizard",
      test: "4.1.3 Status Messages – progress exportu",
      how: "Stav 'Generuji…' a 'Hotovo' v aria-live='assertive' regionu.",
      acceptance: "Screen reader oznámí změnu stavu bez přesunu fokusu.",
    },
    {
      area: "Export wizard",
      test: "3.3.1 Error Identification – chyba exportu",
      how: "Simulovat network error → toast s popisem + krokem 'Zkuste to znovu'.",
      acceptance: "Chyba oznámena textem (role=alert), ne jen ikonou/barvou.",
    },
    {
      area: "Export wizard",
      test: "2.1.2 No Keyboard Trap – uzavření dialogu",
      how: "Esc zavře modál. Focus se vrátí na tlačítko, které modál otevřelo.",
      acceptance: "Po Esc je focus na původním triggeru.",
    },

    // ─── WORKSHEET PLAYER ───
    {
      area: "Worksheet player",
      test: "2.1.1 Keyboard – navigace mezi otázkami",
      how: "Tab/Shift+Tab mezi položkami. Navigační strip (čísla otázek) fokusovatelný.",
      acceptance: "Celý worksheet vyplnitelný klávesnicí.",
    },
    {
      area: "Worksheet player",
      test: "1.3.5 Identify Input Purpose – input fields",
      how: "Textové odpovědi mají aria-label='Odpověď na otázku N'.",
      acceptance: "Screen reader přečte kontext otázky při fokusu na input.",
    },
    {
      area: "Worksheet player",
      test: "3.3.2 Labels or Instructions – MCQ radio buttony",
      how: "Každá MCQ skupina má <fieldset><legend>Otázka N: text</legend> + <label> pro každou volbu.",
      acceptance: "Screen reader přečte otázku i zvolenou odpověď.",
    },
    {
      area: "Worksheet player",
      test: "2.4.7 Focus Visible – focus na aktivní otázce",
      how: "Tab přes MCQ radio, fill-blank inputy, navigační strip.",
      acceptance: "Viditelný focus ring ≥ 3:1 kontrast na všech prvcích.",
    },
    {
      area: "Worksheet player",
      test: "3.3.4 Error Prevention – potvrzení odeslání",
      how: "Klik 'Odeslat' → confirm dialog 'Po odeslání nepůjde změnit'.",
      acceptance: "Uživatel musí potvrdit odeslání. Dialog je focus-trapped.",
    },
    {
      area: "Worksheet player",
      test: "2.2.1 Timing Adjustable – časový limit",
      how: "Pokud je timer, upozornit 2 min předem. Učitel může prodloužit.",
      acceptance: "Varování v aria-live regionu. Bez auto-submit bez upozornění.",
    },
    {
      area: "Worksheet player – true/false",
      test: "4.1.2 Name, Role, Value – checkbox/radio",
      how: "True/False používá <input type='radio'> s label 'Pravda' / 'Nepravda'.",
      acceptance: "Screen reader přečte 'Pravda, radio button, not checked'.",
    },
    {
      area: "Worksheet player – progress",
      test: "4.1.3 Status Messages – autosave potvrzení",
      how: "Po autosave se zobrazí 'Uloženo' v aria-live='polite' regionu.",
      acceptance: "Screen reader oznámí uložení bez přerušení.",
    },
  ],

  notes: [
    "Tón: vykání učiteli, tykání žákům – konzistentní s ui-microcopy.ts.",
    "Prohlášení o přístupnosti: povinnost závisí na typu subjektu (veřejný sektor dle směrnice EU 2016/2102, soukromý sektor dle EAA od 28. 6. 2025). Typ subjektu ZEdu nespecifikován → doporučeno připravit prohlášení preventivně.",
    "ARIA live regiony: toasty (sonner) musí mít role='status' nebo aria-live. Ověřit konfiguraci Sonner/Toaster komponenty.",
    "Drag-and-drop: všechny DnD interakce (matching, ordering, hotspot) MUSÍ mít klávesovou alternativu. Aktuální implementace používá <select> pro matching – OK.",
    "Grafy: pokud používáte Recharts, přidat <desc> do SVG nebo tabulkovou alternativu pod grafem.",
    "Testovací nástroje: axe DevTools (automatické), NVDA + Firefox (manuální screen reader), Lighthouse accessibility audit.",
    "Focus trap v modálech: shadcn/ui Dialog má vestavěný focus trap – ověřit, že custom modály (export wizard) ho využívají.",
    "Barevný kontrast: ověřit všechny stavy (hover, focus, disabled, error) – nejen výchozí stav.",
  ],
} as const;

export type WcagChecklist = typeof WCAG_CHECKLIST;
