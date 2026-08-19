import { PdfCtx, drawText, drawDivider, ensureSpace, drawHeader } from "./pdf-engine.ts";

export const MEETING_TYPE_LABELS: Record<string, string> = {
  predmetova: "Předmětová porada",
  pedagogicka: "Pedagogická rada",
  ctvrtletni: "Čtvrtletní porada",
  pololetni: "Pololetní porada",
  trictvrtletni: "Tříčtvrtletní porada",
  zaverecna: "Závěrečná porada",
};

export interface MeetingRow {
  title?: string | null;
  type?: string | null;
  meeting_date?: string | null;
  content?: string | null;
}

export interface MeetingAttendeeRow {
  teacher_id: string;
  attended?: boolean | null;
  name: string;
  acknowledgedAt?: string | null;
}

export interface MeetingTaskRow {
  task: string;
  due_date?: string | null;
  assigneeName?: string | null;
}

function czDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

export function buildMeetingNotesPdf(
  ctx: PdfCtx,
  meeting: MeetingRow,
  attendees: MeetingAttendeeRow[],
  tasks: MeetingTaskRow[],
  opts: { schoolName?: string | null; authorName?: string | null; date?: string } = {},
): void {
  const typeLabel = MEETING_TYPE_LABELS[meeting.type || ""] || meeting.type || "Porada";
  const sub = [typeLabel, czDate(meeting.meeting_date)].filter(Boolean).join(" · ");
  const meta = [opts.schoolName, opts.authorName ? `Zapsal(a): ${opts.authorName}` : ""]
    .filter(Boolean)
    .join(" · ");
  drawHeader(ctx, meeting.title || "Zápis z porady", [sub, meta].filter(Boolean).join("    "));

  // Obsah zápisu
  drawText(ctx, "Zápis", { size: 14, bold: true });
  ctx.cursorY -= 2;
  if (meeting.content && meeting.content.trim()) {
    meeting.content.split(/\n/).forEach((line) => {
      if (!line.trim()) {
        ctx.cursorY -= 6;
        return;
      }
      ensureSpace(ctx, 30);
      drawText(ctx, line, { size: 10.5 });
    });
  } else {
    drawText(ctx, "Zápis neobsahuje žádný text.", { size: 10.5, color: { r: 0.55, g: 0.45, b: 0.45 } });
  }

  // Účastníci
  ensureSpace(ctx, 80);
  drawDivider(ctx, 12, 10);
  drawText(ctx, `Účastníci (${attendees.length})`, { size: 14, bold: true });
  ctx.cursorY -= 2;
  if (attendees.length === 0) {
    drawText(ctx, "Nebyli evidováni žádní účastníci.", {
      size: 10.5,
      color: { r: 0.55, g: 0.45, b: 0.45 },
    });
  } else {
    const present = attendees.filter((a) => a.attended);
    const absent = attendees.filter((a) => !a.attended);

    drawText(ctx, `Přítomni (${present.length})`, { size: 11.5, bold: true });
    if (present.length === 0) {
      drawText(ctx, "—", { size: 10.5, indent: 12 });
    } else {
      present.forEach((a) => {
        ensureSpace(ctx, 22);
        drawText(ctx, `• ${a.name}`, { size: 10.5, indent: 12 });
      });
    }

    ctx.cursorY -= 6;
    drawText(ctx, `Nepřítomni (${absent.length})`, { size: 11.5, bold: true });
    if (absent.length === 0) {
      drawText(ctx, "—", { size: 10.5, indent: 12 });
    } else {
      absent.forEach((a) => {
        ensureSpace(ctx, 22);
        const ack = a.acknowledgedAt
          ? `potvrzeno přečtení ${czDate(a.acknowledgedAt)}`
          : "nepotvrdil(a) přečtení";
        drawText(ctx, `• ${a.name} — ${ack}`, { size: 10.5, indent: 12 });
      });
    }
  }

  // Úkoly
  ensureSpace(ctx, 80);
  drawDivider(ctx, 12, 10);
  drawText(ctx, `Úkoly z porady (${tasks.length})`, { size: 14, bold: true });
  ctx.cursorY -= 2;
  if (tasks.length === 0) {
    drawText(ctx, "Z porady nevyplynuly žádné úkoly.", {
      size: 10.5,
      color: { r: 0.55, g: 0.45, b: 0.45 },
    });
  } else {
    tasks.forEach((t, i) => {
      ensureSpace(ctx, 34);
      drawText(ctx, `${i + 1}. ${t.task}`, { size: 11, bold: true });
      const detail = [
        t.assigneeName ? `Přiřazeno: ${t.assigneeName}` : "",
        t.due_date ? `Termín: ${czDate(t.due_date)}` : "",
      ]
        .filter(Boolean)
        .join("   ·   ");
      if (detail) drawText(ctx, detail, { size: 10, indent: 12, color: { r: 0.4, g: 0.4, b: 0.45 } });
      ctx.cursorY -= 4;
    });
  }
}
