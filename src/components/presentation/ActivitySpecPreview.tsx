import { activityTypeLabel } from "@/lib/presentation-activity";

const txt = (v: unknown) => String((v as any)?.text ?? v ?? "").replace(/<[^>]*>/g, "").trim();

/** Položky aktivity pro náhled na plátně (jen čtení, max. 6). */
export function activityPreviewItems(spec: any): { text: string; ok?: boolean }[] {
  const at = String(spec?.activityType ?? "");
  if ((at === "mcq" || at === "poll") && Array.isArray(spec?.options))
    return spec.options.map((o: any, i: number) => ({ text: txt(o), ok: at === "mcq" ? (o?.correct ?? o?.isCorrect ?? i === spec.correctIndex) : undefined }));
  if (at === "quiz") return (spec?.quiz?.questions ?? []).map((q: any) => ({ text: txt(q?.question) }));
  if (at === "true_false") return (spec?.trueFalse?.statements ?? []).map((x: any) => ({ text: txt(x), ok: !!(x?.isTrue ?? x?.correct) }));
  if (at === "matching") {
    const l: any[] = spec?.matching?.left ?? []; const r: any[] = spec?.matching?.right ?? [];
    return l.map((x, i) => ({ text: `${txt(x)} → ${txt(r[i])}` }));
  }
  if (at === "ordering") return (spec?.ordering?.items ?? []).map((x: any, i: number) => ({ text: `${i + 1}. ${txt(x)}` }));
  if (at === "sorting") return (spec?.sorting?.items ?? []).map((x: any) => ({ text: txt(x?.text ?? x) }));
  if (at === "escape") return (spec?.locks ?? []).map((x: any, i: number) => ({ text: `Zámek ${i + 1}: ${txt(x?.clue)}` }));
  return [];
}

/**
 * Náhled aktivity na plátně editoru pro slidy, které nesou jen `activitySpec`
 * (šablony aktivit, AI aktivita). Dřív se zobrazil prázdný slide.
 */
export default function ActivitySpecPreview({ spec }: { spec: any }) {
  const items = activityPreviewItems(spec).filter((i) => i.text).slice(0, 6);
  const question = txt(spec?.question);
  return (
    <div
      data-testid="activity-spec-preview"
      className="mx-auto w-full max-w-[1200px] rounded-[2rem] bg-deck-cream p-10 font-deck-body text-deck-violet-deep shadow-lg"
    >
      <span className="inline-flex rounded-full bg-deck-teal px-6 py-2 text-[1.4rem] font-semibold uppercase tracking-wide text-deck-violet-deep">
        Aktivita · {activityTypeLabel(spec?.activityType)}
      </span>
      {question && <p className="mt-6 font-deck-heading text-[2.6rem] uppercase leading-tight">{question}</p>}
      {items.length > 0 ? (
        <ul className="mt-6 grid grid-cols-2 gap-4">
          {items.map((it, i) => (
            <li
              key={i}
              className={`rounded-2xl border-2 px-6 py-4 text-[1.6rem] ${it.ok ? "border-deck-teal bg-background" : "border-border bg-background"}`}
            >
              {it.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-[1.5rem] opacity-80">Žáci odpovídají na svých zařízeních. Obsah aktivity upravíte v panelu Slide.</p>
      )}
    </div>
  );
}
