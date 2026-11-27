import { activityTypeLabel } from "@/lib/presentation-activity";
import { activityCardStyle } from "@/lib/activity-colors";

const txt = (v: unknown) => String((v as any)?.text ?? v ?? "").replace(/<[^>]*>/g, "").trim();

/** Položky aktivity pro náhled na plátně (jen čtení, max. 6). */
export function activityPreviewItems(spec: any, revealAnswers = false): { text: string; ok?: boolean }[] {
  const at = String(spec?.activityType ?? "");
  if ((at === "mcq" || at === "poll") && Array.isArray(spec?.options))
    return spec.options.map((o: any, i: number) => ({
      text: txt(o),
      ok: revealAnswers && at === "mcq" ? (o?.correct ?? o?.isCorrect ?? i === spec.correctIndex) : undefined,
    }));
  if (at === "quiz") return (spec?.quiz?.questions ?? []).map((q: any) => ({ text: txt(q?.question) }));
  if (at === "true_false") return (spec?.trueFalse?.statements ?? []).map((x: any) => ({
    text: txt(x),
    ok: revealAnswers ? !!(x?.isTrue ?? x?.correct) : undefined,
  }));
  if (at === "matching") {
    const l: any[] = spec?.matching?.left ?? []; const r: any[] = spec?.matching?.right ?? [];
    return l.map((x, i) => ({ text: `${txt(x)} → ${revealAnswers ? txt(r[i]) : "?"}` }));
  }
  if (at === "ordering") {
    const items: any[] = spec?.ordering?.items ?? [];
    const shown = revealAnswers ? items : [...items].sort((a, b) => txt(a).localeCompare(txt(b), "cs"));
    return shown.map((x: any, i: number) => ({ text: revealAnswers ? `${i + 1}. ${txt(x)}` : `• ${txt(x)}` }));
  }
  if (at === "sorting") return (spec?.sorting?.items ?? []).map((x: any) => ({ text: txt(x?.text ?? x) }));
  if (at === "escape") return (spec?.locks ?? []).map((x: any, i: number) => ({ text: `Zámek ${i + 1}: ${txt(x?.clue)}` }));
  return [];
}

/**
 * Náhled aktivity na plátně. Řešení je skryté, dokud jej soukromý učitelský
 * náhled nebo editor výslovně neodhalí pomocí `revealAnswers`.
 */
export default function ActivitySpecPreview({ spec, revealAnswers = false, showEditorHint = true }: { spec: any; revealAnswers?: boolean; showEditorHint?: boolean }) {
  const at = String(spec?.activityType ?? "");
  const choice = at === "mcq" || at === "poll";
  let items = activityPreviewItems(spec, revealAnswers).slice(0, 6);
  // Prázdný kvíz/anketa: viditelná místa pro odpovědi místo prázdné karty.
  if (choice && items.filter((i) => i.text).length === 0) items = [1, 2, 3, 4].map((n) => ({ text: "", n } as any));
  else items = items.filter((i) => i.text);
  const question = txt(spec?.question);
  const placeholder = "opacity-60 italic";
  return (
    <div
      data-testid="activity-spec-preview"
      data-activity-surface
      className="mx-auto w-full max-w-[1200px] rounded-[2rem] border-4 p-10 font-deck-body shadow-lg"
      style={activityCardStyle(spec?.colors)}
    >
      <span
        className="inline-flex rounded-full px-6 py-2 text-[1.4rem] font-semibold uppercase tracking-wide"
        style={{ backgroundColor: "var(--activity-accent)", color: "var(--activity-accent-text)" }}
      >
        Aktivita · {activityTypeLabel(spec?.activityType)}
      </span>
      {(question || choice) && (
        <p className={`mt-6 font-deck-heading text-[2.6rem] uppercase leading-tight ${question ? "" : placeholder}`}>
          {question || "Sem napište otázku (v panelu vpravo)"}
        </p>
      )}
      {items.length > 0 ? (
        <ul className="mt-6 grid grid-cols-2 gap-4">
          {items.map((it: any, i) => {
            const showCorrect = revealAnswers && it.ok === true;
            return (
              <li
                key={i}
                data-correct={showCorrect ? "true" : undefined}
                className={`rounded-2xl border-4 px-6 py-4 text-[1.6rem] ${it.text ? "" : placeholder}`}
                style={{
                  backgroundColor: "var(--activity-answer)",
                  color: "var(--activity-answer-text)",
                  borderColor: showCorrect ? "var(--activity-accent)" : "transparent",
                }}
              >
                {it.text || `Odpověď ${i + 1}`}
                {showCorrect && <span className="ml-3 text-[1.2rem] font-semibold">✓ správná</span>}
              </li>
            );
          })}
        </ul>
      ) : showEditorHint ? (
        <p className="mt-6 text-[1.5rem] opacity-80">Žáci odpovídají na svých zařízeních. Obsah aktivity upravíte v panelu vpravo.</p>
      ) : null}
    </div>
  );
}
