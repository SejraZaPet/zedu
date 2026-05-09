/**
 * RFC 5545 (iCalendar) export helpers + Google Calendar URL builder.
 */

export interface CalendarExportEvent {
  uid?: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  /** RFC 5545 RRULE without the "RRULE:" prefix, e.g. "FREQ=WEEKLY;INTERVAL=2;COUNT=20;BYDAY=MO" */
  rrule?: string;
}

const PRODID = "-//ZEdu//Calendar//CS";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

/** YYYYMMDDTHHMMSSZ (UTC). */
export function toICSDate(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** Escape per RFC 5545 §3.3.11. */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Fold long lines to 75 octets per §3.1. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    out.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
    i += 73;
  }
  return out.join("\r\n");
}

function makeUid(ev: CalendarExportEvent): string {
  if (ev.uid) return ev.uid;
  const stamp = ev.start.getTime().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${rand}@zedu.cz`;
}

function buildVEvent(ev: CalendarExportEvent, dtstamp: string): string {
  const lines = [
    "BEGIN:VEVENT",
    fold(`UID:${makeUid(ev)}`),
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toICSDate(ev.start)}`,
    `DTEND:${toICSDate(ev.end)}`,
    fold(`SUMMARY:${escapeText(ev.title)}`),
  ];
  if (ev.description) lines.push(fold(`DESCRIPTION:${escapeText(ev.description)}`));
  if (ev.location) lines.push(fold(`LOCATION:${escapeText(ev.location)}`));
  if (ev.rrule) lines.push(`RRULE:${ev.rrule}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export function generateICS(events: CalendarExportEvent[], calName = "ZEdu kalendář"): string {
  const dtstamp = toICSDate(new Date());
  const body = events.map((e) => buildVEvent(e, dtstamp)).join("\r\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${escapeText(calName)}`),
    body,
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Trigger a browser download of the .ics file. */
export function downloadICS(events: CalendarExportEvent[], filename = "zedu-kalendar.ics", calName?: string) {
  const ics = generateICS(events, calName);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Build a Google Calendar "Add event" URL.
 * Docs: https://support.google.com/calendar/answer/9314811
 */
export function generateGoogleCalendarUrl(event: CalendarExportEvent): string {
  const dates = `${toICSDate(event.start)}/${toICSDate(event.end)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
  });
  if (event.description) params.set("details", event.description);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Compose ICS content into a data: URL (used as a "subscribe" link to copy). */
export function buildIcsDataUrl(events: CalendarExportEvent[], calName?: string): string {
  const ics = generateICS(events, calName);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

/** Map app's CalendarEvent → CalendarExportEvent. */
export function toExportEvent(e: {
  title: string;
  start: Date;
  end: Date;
  subject?: string;
  className?: string;
  room?: string;
  type?: string;
}): CalendarExportEvent {
  const locationParts = [e.className, e.room].filter(Boolean);
  const descParts: string[] = [];
  if (e.subject && e.subject !== e.title) descParts.push(`Předmět: ${e.subject}`);
  if (e.type) descParts.push(`Typ: ${e.type}`);
  return {
    title: e.title,
    start: e.start,
    end: e.end,
    location: locationParts.join(" · ") || undefined,
    description: descParts.join("\n") || undefined,
  };
}

/** Day-of-week → RRULE BYDAY value. day: 1=Mon … 7=Sun (ISO). */
const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
export function bydayFromIso(day: number): string {
  return BYDAY[Math.max(1, Math.min(7, day)) - 1];
}

/**
 * Build a recurring RRULE for a schedule slot.
 * @param weekParity "every" → weekly, "odd"/"even" → bi-weekly (INTERVAL=2)
 * @param day_of_week ISO day number (1=Mon)
 * @param until end of recurrence (UTC)
 */
export function buildScheduleRrule(
  weekParity: "every" | "odd" | "even",
  day_of_week: number,
  until: Date,
): string {
  const interval = weekParity === "every" ? 1 : 2;
  return `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${bydayFromIso(day_of_week)};UNTIL=${toICSDate(until)}`;
}
