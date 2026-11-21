export const BEZLAI_GENERAL_SOURCE_LABEL = "Obecné vysvětlení AI – nemá ověřený zdroj, může se mýlit.";

/** Pevné texty návodu. Tyna může doplnit odkazy pro jednotlivé odbornosti bez změny komponenty. */
export const BEZLAI_VERIFICATION_GUIDE = {
  title: "Jak si to ověřit",
  intro: "Odpověď AI je jen pomoc při učení, ne důkaz. Ověř si důležité informace dřív, než je použiješ.",
  bezliTitle: "Kde hledat v Bezli",
  bezliIntro: "Vyhledej si lekci podle názvu, předmětu nebo učebnice. Můžeš se podívat i do vlastních poznámek a materiálů.",
  lessonsLabel: "Najít lekci",
  notebooksLabel: "Otevřít moje sešity",
  materialLabel: "Otevřít Můj materiál",
  generalTitle: "Jak hledat obecně",
  generalPoints: [
    "Použij klíčová slova z otázky. Zkus i jiné pojmenování téhož tématu.",
    "Porovnej aspoň dva nezávislé zdroje, které od sebe informaci neopsaly.",
    "Hledej autora a datum. Upřednostni učebnice a odborné nebo oficiální zdroje.",
    "Pozor na reklamy a recepty bez uvedeného zdroje. Oblíbenost stránky neznamená správnost.",
  ],
  reliableTitle: "Jak poznat spolehlivý zdroj",
  reliablePoints: [
    "Je jasné, kdo text napsal a jakou má s tématem zkušenost?",
    "Je informace aktuální a je u ní datum?",
    "Shodují se s ní i jiné nezávislé a odborné zdroje?",
  ],
  unsureTitle: "Když si nejsi jistý",
  unsureText: "Nevím to jistě. Jsem AI a můžu se mýlit. Ověř si to v lekci nebo se zeptej učitele.",
  teacherLabel: "Ověřit s učitelem",
} as const;

export interface BezlaiMessengerDraft {
  teacherId: string;
  text: string;
}

const MESSENGER_DRAFT_KEY = "bezli.bezlai.teacher-verification";

export function buildBezlaiTeacherMessage(question: string, answer: string): string {
  return `Dobrý den, můžete mi prosím pomoct ověřit odpověď od Bezlai?\n\nMoje otázka:\n${question.trim().slice(0, 4000)}\n\nOdpověď Bezlai:\n${answer.trim().slice(0, 4000)}\n\nJe to správné? Kde to najdu v našich materiálech? Děkuji.`;
}

/** Jen relace prohlížeče; žádná zpráva ani konverzace se tímto nezakládá. */
export function saveBezlaiMessengerDraft(draft: BezlaiMessengerDraft): boolean {
  try {
    if (!draft.teacherId.trim() || !draft.text.trim() || draft.text.length > 12000) return false;
    sessionStorage.setItem(MESSENGER_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function readBezlaiMessengerDraft(): BezlaiMessengerDraft | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(MESSENGER_DRAFT_KEY) ?? "null") as Partial<BezlaiMessengerDraft> | null;
    if (!value || typeof value.teacherId !== "string" || typeof value.text !== "string" || !value.teacherId || !value.text.trim() || value.text.length > 12000) return null;
    return { teacherId: value.teacherId, text: value.text };
  } catch {
    return null;
  }
}

export function clearBezlaiMessengerDraft(): void {
  try { sessionStorage.removeItem(MESSENGER_DRAFT_KEY); } catch { /* Soukromý režim nesmí rozbít zprávy. */ }
}
