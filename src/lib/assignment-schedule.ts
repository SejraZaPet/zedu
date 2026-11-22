// Naplánované zveřejnění v Úkolech: společný čas formuláře NEBO vlastní čas u cíle.
export interface ScheduleTarget { key: string; publishAt: string }

/** ISO ze společného data + času (HH:MM), nebo null. */
export function globalScheduleIso(date: Date | null | undefined, time: string): string | null {
  if (!date) return null;
  const [h, m] = (time || "").split(":").map((n) => parseInt(n, 10));
  const when = new Date(date);
  when.setHours(Number.isFinite(h) ? h : 8, Number.isFinite(m) ? m : 0, 0, 0);
  return isNaN(when.getTime()) ? null : when.toISOString();
}

const ownIso = (t: ScheduleTarget) => { if (!t.publishAt) return null; const d = new Date(t.publishAt); return isNaN(d.getTime()) ? "invalid" : d.toISOString(); };

/** Proč nejde naplánovat (null = jde). Pro tlačítko i tooltip. */
export function scheduleBlocker(globalIso: string | null, targets: ScheduleTarget[], isEdit = false): string | null {
  if (globalIso) return null;
  if (isEdit) return "Zapněte „Naplánovat zveřejnění“ a vyberte datum a čas.";
  if (!targets.length) return "Nejdřív vyberte třídu nebo skupinu a čas zveřejnění.";
  const missing = targets.filter((t) => !ownIso(t));
  if (missing.length === targets.length) return "Vyberte datum a čas zveřejnění nahoře nebo u každého cíle.";
  if (missing.length) return `Doplňte čas zveřejnění u ${missing.length === 1 ? "jednoho cíle" : `${missing.length} cílů`}, nebo zapněte společné naplánování nahoře.`;
  return null;
}

/** Čas zveřejnění pro každý cíl; vyhodí srozumitelnou chybu. `unchangedIso` = původní čas při úpravě (smí být v minulosti). */
export function resolveTargetSchedule(globalIso: string | null, targets: ScheduleTarget[], now = Date.now(), unchangedIso: string | null = null): string[] {
  const blocker = scheduleBlocker(globalIso, targets);
  if (blocker) throw new Error(blocker);
  return targets.map((t) => {
    const own = ownIso(t);
    if (own === "invalid") throw new Error("Čas zveřejnění u cíle není platný.");
    const iso = own ?? globalIso!;
    if (new Date(iso).getTime() <= now && iso !== unchangedIso) throw new Error(own ? "Čas zveřejnění u každého cíle musí být v budoucnosti." : "Čas zveřejnění musí být v budoucnosti.");
    return iso;
  });
}
