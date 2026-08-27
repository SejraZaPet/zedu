/**
 * Náhled zadání aktivit, které žáci plní na svých zařízeních
 * (doplňovačky, aktivní body v obrázku, křížovka).
 *
 * Používá se na projektoru (bez řešení) i na obrazovce učitele
 * (`showSolution` odhalí správné odpovědi).
 */

import { generateCrosswordGrid } from "@/lib/crossword-engine";

interface Props {
  spec: any;
  showSolution?: boolean;
  /** Tmavé pozadí projektoru vs. světlý panel učitele. */
  darkMode?: boolean;
}

export const hasActivityTaskPreview = (spec: any) =>
  [
    "fill_blanks",
    "fill_choice",
    "image_hotspot",
    "crossword",
    "flashcards",
    "reveal_cards",
    "memory_game",
    "image_label",
    "true_false",
    "matching",
    "ordering",
    "sorting",
  ].includes(spec?.activityType);

const blanksFromText = (text: string, reveal: boolean) => {
  const parts: { text: string; blank: boolean }[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), blank: false });
    parts.push({ text: reveal ? m[1].split("/")[0].trim() : "______", blank: true });
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push({ text: text.slice(last), blank: false });
  return parts;
};

const ActivityTaskPreview = ({ spec, showSolution = false, darkMode = false }: Props) => {
  const type = spec?.activityType;
  const base = darkMode ? "text-white" : "text-foreground";
  const muted = darkMode ? "text-white/70" : "text-muted-foreground";
  const chip = darkMode
    ? "bg-white/15 border-white/30 text-white"
    : "bg-primary/10 border-primary/30 text-primary";

  if (type === "fill_blanks") {
    const parts = blanksFromText(String(spec?.fillBlanks?.text || ""), showSolution);
    if (!parts.length) return null;
    return (
      <p className={`leading-relaxed ${base}`}>
        {parts.map((p, i) =>
          p.blank ? (
            <span key={i} className={`mx-1 rounded border px-2 py-0.5 font-semibold ${chip}`}>
              {p.text}
            </span>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </p>
    );
  }

  if (type === "fill_choice") {
    const tokens: any[] = Array.isArray(spec?.fillChoice?.tokens) ? spec.fillChoice.tokens : [];
    const options: string[] = Array.isArray(spec?.fillChoice?.options) ? spec.fillChoice.options : [];
    if (!tokens.length) return null;
    return (
      <div className="space-y-3">
        <p className={`leading-relaxed ${base}`}>
          {tokens.map((t, i) =>
            t?.type === "blank" ? (
              <span key={i} className={`mx-1 rounded border px-2 py-0.5 font-semibold ${chip}`}>
                {showSolution ? t.answer || "" : "______"}
              </span>
            ) : (
              <span key={i}>{t?.value || ""}</span>
            ),
          )}
        </p>
        {options.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {options.map((o, i) => (
              <span key={i} className={`rounded-full border px-3 py-1 text-sm ${chip}`}>
                {o}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (type === "image_hotspot") {
    const imageUrl = spec?.imageHotspot?.imageUrl;
    const hotspots: any[] = Array.isArray(spec?.imageHotspot?.hotspots)
      ? spec.imageHotspot.hotspots
      : [];
    if (!imageUrl) return null;
    return (
      <div className="space-y-3">
        <div className="relative inline-block max-w-full">
          <img
            src={imageUrl}
            alt="Obrázek aktivity s aktivními body"
            className="max-h-[45vh] w-auto max-w-full rounded-xl border border-white/20 object-contain"
          />
          {showSolution &&
            hotspots.map((h, i) => (
              <span
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary/30"
                style={{
                  left: `${h.x ?? 50}%`,
                  top: `${h.y ?? 50}%`,
                  width: `${(h.radius ?? 8) * 2}%`,
                  aspectRatio: "1 / 1",
                }}
              />
            ))}
        </div>
        {hotspots.length > 0 && (
          <ol className={`list-decimal space-y-0.5 pl-5 text-sm ${muted}`}>
            {hotspots.map((h, i) => (
              <li key={i}>{h.label || "—"}</li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  if (type === "crossword") {
    const entries: any[] = Array.isArray(spec?.crossword?.entries) ? spec.crossword.entries : [];
    const grid = generateCrosswordGrid(
      entries.filter((e) => e?.answer).map((e) => ({ answer: String(e.answer), clue: String(e.clue || "") })),
    );
    if (!grid) return null;
    return (
      <div className="space-y-3">
        <div className="inline-block">
          {grid.cells.map((row, r) => (
            <div key={r} className="flex">
              {row.map((cell, c) => (
                <div
                  key={c}
                  className={`flex h-7 w-7 items-center justify-center border text-xs font-bold ${
                    cell === null
                      ? "border-transparent"
                      : darkMode
                      ? "border-white/40 bg-white/10 text-white"
                      : "border-border bg-muted text-foreground"
                  }`}
                >
                  {cell !== null && showSolution ? cell : ""}
                </div>
              ))}
            </div>
          ))}
        </div>
        <ol className={`space-y-0.5 text-sm ${muted}`}>
          {grid.words.map((w) => (
            <li key={`${w.number}-${w.direction}`}>
              {w.number}. {w.direction === "across" ? "→" : "↓"} {w.clue}
              {showSolution ? ` — ${w.answer}` : ""}
            </li>
          ))}
        </ol>
      </div>
    );
  }


  if (type === "flashcards" || type === "reveal_cards" || type === "memory_game") {
    const rows: any[] =
      type === "flashcards"
        ? Array.isArray(spec?.flashcards)
          ? spec.flashcards
          : []
        : type === "reveal_cards"
        ? Array.isArray(spec?.revealCards?.cards)
          ? spec.revealCards.cards
          : []
        : Array.isArray(spec?.memoryGame?.pairs)
        ? spec.memoryGame.pairs
        : [];
    if (!rows.length) return null;
    const front = (r: any) =>
      type === "flashcards" ? r.front : type === "reveal_cards" ? r.title : r.left;
    const back = (r: any) =>
      type === "flashcards" ? r.back : type === "reveal_cards" ? r.content : r.right;
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((r, i) => (
          <div key={i} className={`rounded-lg border px-3 py-2 text-sm ${chip}`}>
            <span className="font-semibold">{front(r) || "—"}</span>
            {showSolution && back(r) ? (
              <span className={`ml-2 ${muted}`}>· {back(r)}</span>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (type === "true_false") {
    const statements: any[] = Array.isArray(spec?.trueFalse?.statements)
      ? spec.trueFalse.statements
      : [];
    if (!statements.length) return null;
    return (
      <ol className={`list-decimal space-y-1 pl-5 ${base}`}>
        {statements.map((st, i) => (
          <li key={i}>
            {st.text || "—"}
            {showSolution ? (
              <span className={`ml-2 font-semibold ${muted}`}>
                {st.isTrue ? "· Pravda" : "· Nepravda"}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    );
  }

  if (type === "matching") {
    const left: string[] = Array.isArray(spec?.matching?.left) ? spec.matching.left : [];
    const right: string[] = Array.isArray(spec?.matching?.right) ? spec.matching.right : [];
    if (!left.length) return null;
    return (
      <div className="space-y-2">
        {left.map((l, i) => (
          <div key={i} className={`flex items-center gap-2 text-sm ${base}`}>
            <span className={`rounded border px-2 py-0.5 ${chip}`}>{l || "—"}</span>
            <span className={muted}>→</span>
            <span className={`rounded border px-2 py-0.5 ${chip}`}>
              {showSolution ? right[i] || "—" : "?"}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "ordering") {
    const items: string[] = Array.isArray(spec?.ordering?.items) ? spec.ordering.items : [];
    if (!items.length) return null;
    const shown = showSolution ? items : [...items].sort((a, b) => a.localeCompare(b, "cs"));
    return (
      <ol className={`space-y-1 ${base}`}>
        {shown.map((it, i) => (
          <li key={i} className={`rounded border px-2 py-1 text-sm ${chip}`}>
            {showSolution ? `${i + 1}. ` : "• "}
            {it || "—"}
          </li>
        ))}
      </ol>
    );
  }

  if (type === "sorting") {
    const groups: string[] = Array.isArray(spec?.sorting?.groups) ? spec.sorting.groups : [];
    const items: any[] = Array.isArray(spec?.sorting?.items) ? spec.sorting.items : [];
    if (!groups.length) return null;
    return (
      <div className="space-y-3">
        {!showSolution && items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {items.map((it, i) => (
              <span key={i} className={`rounded-full border px-3 py-1 text-sm ${chip}`}>
                {it.text || "—"}
              </span>
            ))}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {groups.map((g, gi) => (
            <div key={gi} className={`rounded-lg border px-3 py-2 ${chip}`}>
              <p className="text-sm font-semibold">{g || `Skupina ${gi + 1}`}</p>
              {showSolution && (
                <ul className={`mt-1 space-y-0.5 text-xs ${muted}`}>
                  {items
                    .filter((it) => Number(it.group) === gi)
                    .map((it, i) => (
                      <li key={i}>{it.text || "—"}</li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "image_label") {
    const imageUrl = spec?.imageLabel?.imageUrl;
    const markers: any[] = Array.isArray(spec?.imageLabel?.markers) ? spec.imageLabel.markers : [];
    if (!imageUrl) return null;
    return (
      <div className="space-y-3">
        <div className="relative inline-block max-w-full">
          <img
            src={imageUrl}
            alt="Obrázek k popisu"
            className="max-h-[45vh] w-auto max-w-full rounded-xl border border-white/20 object-contain"
          />
          {markers.map((m, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary/40 px-2 py-0.5 text-xs font-bold text-white"
              style={{ left: `${m.x ?? 50}%`, top: `${m.y ?? 50}%` }}
            >
              {showSolution ? m.label || i + 1 : i + 1}
            </span>
          ))}
        </div>
        {!showSolution && markers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {markers.map((m, i) => (
              <span key={i} className={`rounded-full border px-3 py-1 text-sm ${chip}`}>
                {m.label || "—"}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default ActivityTaskPreview;
