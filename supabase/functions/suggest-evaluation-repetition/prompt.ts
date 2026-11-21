export interface EvaluationCandidate {
  key: string;
  label: string;
  successPct: number | null;
  evidenceCount: number;
  attemptCount: number;
  trendDelta: number | null;
}

export interface EvaluationSuggestion {
  key: string;
  title: string;
  reason: string;
}

const finiteNumber = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/** Přísná bílá listina polí; jakákoli identita nebo odpovědi v extra polích se zahodí. */
export function sanitizeEvaluationCandidates(raw: unknown): EvaluationCandidate[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).flatMap((value): EvaluationCandidate[] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const row = value as Record<string, unknown>;
    const key = typeof row.key === "string" ? row.key.trim() : "";
    const label = typeof row.label === "string" ? row.label.trim().slice(0, 160) : "";
    if (!key || key.length > 220 || !/^(lesson|subject):.+/.test(key) || !label) return [];
    const success = finiteNumber(row.successPct);
    const evidence = finiteNumber(row.evidenceCount);
    const attempts = finiteNumber(row.attemptCount);
    const trend = finiteNumber(row.trendDelta);
    return [{
      key,
      label,
      successPct: success === null ? null : Math.round(Math.max(0, Math.min(100, success))),
      evidenceCount: Math.max(0, Math.round(evidence ?? 0)),
      attemptCount: Math.max(0, Math.round(attempts ?? 0)),
      trendDelta: trend === null ? null : Math.max(-100, Math.min(100, Math.round(trend))),
    }];
  });
}

export function buildEvaluationRepetitionPrompt(subject: string, candidates: EvaluationCandidate[]): string {
  const safeSubject = subject.trim().slice(0, 160) || "Předmět";
  const payload = {
    pseudonym: "Žák A",
    subject: safeSubject,
    topics: candidates.map((candidate) => ({
      id: candidate.key,
      topic: candidate.label,
      success_pct: candidate.successPct,
      evidence_count: candidate.evidenceCount,
      attempt_count: candidate.attemptCount,
      trend_change_pct: candidate.trendDelta,
    })),
  };
  return `Jsi pedagogický asistent pro učitele. Navrhni 3–5 témat k opakování pro jednoho žáka.

PRAVIDLA:
- Vyberte POUZE id z pole topics v JSON níže. Nikdy nevymýšlej jiné téma, lekci, předmět ani identifikátor.
- Vrať pouze JSON {"suggestions":[{"id":"...","reason":"..."}]}. Důvod je česky, stručně a vychází jen z úspěšnosti, počtu podkladů a trendu.
- Nepiš známku ani diagnostiku. Nehodnoť osobnost ani schopnosti dítěte. U méně než 3 podkladů u tématu připomeň, že je závěr orientační.
- V datech není jméno ani identita. Nepřidávej žádné osobní údaje, citace odpovědí, odkazy ani doporučení mimo dodaný seznam.

DATA (pseudonymizovaná čísla jednoho žáka):
${JSON.stringify(payload)}`;
}

function reasonForFallback(candidate: EvaluationCandidate): string {
  const success = candidate.successPct === null ? "bez dostupné úspěšnosti" : `úspěšnost ${candidate.successPct} %`;
  return `Téma je v dodaném seznamu s ${success}; počet podkladů je ${candidate.evidenceCount}. Ověřte doporučení podle vlastní zkušenosti.`;
}

/** Model nemůže prosadit cizí ani vymyšlené téma; názvy vždy pocházejí ze serverové bílé listiny. */
export function normalizeEvaluationSuggestions(raw: unknown, candidates: EvaluationCandidate[]): EvaluationSuggestion[] {
  const candidateByKey = new Map(candidates.map((candidate) => [candidate.key, candidate]));
  const rawItems = raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray((raw as Record<string, unknown>).suggestions)
    ? (raw as Record<string, unknown>).suggestions as unknown[]
    : [];
  const output: EvaluationSuggestion[] = [];
  const used = new Set<string>();
  for (const value of rawItems) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    const key = typeof row.id === "string" ? row.id : typeof row.key === "string" ? row.key : "";
    const candidate = candidateByKey.get(key);
    if (!candidate || used.has(key)) continue;
    const reason = typeof row.reason === "string" && row.reason.trim()
      ? row.reason.trim().slice(0, 500)
      : reasonForFallback(candidate);
    output.push({ key, title: candidate.label, reason });
    used.add(key);
    if (output.length === 5) break;
  }
  // AI občas vrátí méně než 3 položky. Doplňujeme jen dodaná témata, nikdy nový obsah.
  if (output.length < 3) {
    const ordered = [...candidates].sort((a, b) => (a.successPct ?? 101) - (b.successPct ?? 101) || a.label.localeCompare(b.label, "cs"));
    for (const candidate of ordered) {
      if (used.has(candidate.key)) continue;
      output.push({ key: candidate.key, title: candidate.label, reason: reasonForFallback(candidate) });
      used.add(candidate.key);
      if (output.length === 3) break;
    }
  }
  return output.slice(0, 5);
}
