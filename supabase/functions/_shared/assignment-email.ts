// Šablona e-mailu k nově zveřejněné položce (úkol / materiál / oznámení). Žákům se tyká.
// Čisté funkce bez síťových volání, aby šly testovat bez odesílání.

export type Kind = "task" | "material" | "announcement";

export interface AssignmentEmailInput {
  title: string;
  description?: string | null;
  deadline?: string | null;
  settings?: unknown;
  subject?: string | null;
  teacher?: string | null;
  target?: string | null; // třída nebo skupina
  url: string;
}

const obj = (s: unknown): Record<string, unknown> =>
  s && typeof s === "object" && !Array.isArray(s) ? (s as Record<string, unknown>) : {};

export function kindOf(settings: unknown): Kind {
  const k = obj(settings).kind;
  return k === "material" || k === "announcement" ? k : "task";
}

/** Chybí-li volba: úkol a oznámení ano, materiál ne. */
export function shouldEmail(settings: unknown): boolean {
  const v = obj(settings).notifyEmail;
  return typeof v === "boolean" ? v : kindOf(settings) !== "material";
}

/** „čtvrtek 12. 11. 2026, 23:59“ v pražském čase. */
export function formatPragueDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague", weekday: "long", day: "numeric", month: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${p("weekday")} ${p("day")}. ${p("month")}. ${p("year")}, ${p("hour").padStart(2, "0")}:${p("minute")}`;
}

/** HTML popis → prostý text, max. `max` znaků. */
export function shortText(html: string | null | undefined, max = 300): string {
  const t = String(html ?? "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

export function lateLine(settings: unknown): string | null {
  const v = obj(settings).lateUntil;
  if (v === "unlimited") return "Odevzdat můžeš i po termínu, bez omezení.";
  if (typeof v === "string" && Number.isFinite(new Date(v).getTime())) {
    return `Odevzdat můžeš i po termínu, nejpozději do ${formatPragueDate(v)}.`;
  }
  return null;
}

export interface BuiltEmail { subject: string; heading: string; lines: string[]; button: string }

export function buildAssignmentEmail(a: AssignmentEmailInput): BuiltEmail {
  const kind = kindOf(a.settings);
  const teacher = a.teacher?.trim() || "Tvůj učitel";
  const subj = a.subject?.trim();
  const where = [subj ? `v předmětu ${subj}` : null, a.target ? `pro ${a.target}` : null].filter(Boolean).join(" ");
  const desc = shortText(a.description);
  if (kind === "announcement") {
    return {
      subject: `Oznámení od ${teacher}: ${a.title}`,
      heading: a.title,
      lines: [`Ahoj, ${teacher} ti poslal(a) oznámení${where ? ` ${where}` : ""}.`, ...(desc ? [desc] : [])],
      button: "Otevřít oznámení",
    };
  }
  if (kind === "material") {
    return {
      subject: `Nový materiál: ${a.title}${subj ? ` (${subj})` : ""}`,
      heading: a.title,
      lines: [`Ahoj, ${teacher} ti sdílel(a) nový materiál${where ? ` ${where}` : ""}.`, ...(desc ? [desc] : [])],
      button: "Otevřít materiál",
    };
  }
  const due = a.deadline ? formatPragueDate(a.deadline) : "";
  const late = a.deadline ? lateLine(a.settings) : null;
  return {
    subject: `Nový úkol: ${a.title}${subj ? ` (${subj})` : ""}`,
    heading: a.title,
    lines: [
      `Ahoj, ${teacher} ti zadal(a) nový úkol${where ? ` ${where}` : ""}.`,
      `Termín odevzdání: ${due || "bez termínu"}`,
      ...(late ? [late] : []),
      ...(desc ? [desc] : []),
    ],
    button: "Otevřít úkol",
  };
}
