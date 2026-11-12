/**
 * Jedna společná čekárna pro všechny živé aktivity před kliknutím na „Spustit“.
 * Žák vidí výzvu bez možnosti odpovídat, projektor jen zadání bez možností a odpočtu.
 */
import { Hourglass } from "lucide-react";

export const awaitingQuestionText = (slide: any): string =>
  String(
    slide?.activitySpec?.question ||
      slide?.activitySpec?.title ||
      slide?.projector?.headline ||
      "",
  );

/** Název aktivity pro výzvu „Spustit“: název → nadpis snímku → otázka. */
export const awaitingActivityTitle = (slide: any): string =>
  String(
    slide?.activitySpec?.title ||
      slide?.projector?.headline ||
      slide?.activitySpec?.question ||
      "",
  ).trim();

export const awaitingStartMessage = (slide: any): string => {
  const t = awaitingActivityTitle(slide);
  return t ? `Aktivita „${t}“ začne, až ji učitel spustí.` : "Aktivita začne, až ji učitel spustí.";
};

const AwaitingStartNotice = ({ slide, variant }: { slide: any; variant: "student" | "projector" }) => {
  const question = awaitingQuestionText(slide);
  const big = variant === "projector";
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="awaiting-start"
      className={`live-game-surface mx-auto flex w-full flex-col items-center gap-3 rounded-xl text-center ${big ? "max-w-4xl px-10 py-8" : "max-w-md px-4 py-6"}`}
    >
      {question && variant === "projector" && (
        <p className="text-4xl font-bold leading-snug break-words">{question}</p>
      )}
      <div className={`flex items-center gap-2 font-medium ${big ? "text-2xl" : "text-lg"}`}>
        <Hourglass className={`shrink-0 ${big ? "h-7 w-7" : "h-5 w-5"}`} aria-hidden />
        <span className="break-words">{awaitingStartMessage(slide)}</span>
      </div>
      {variant === "student" && (
        <p className="text-sm opacity-80">Zatím nic nevyplňuj, odpovídat půjde po spuštění.</p>
      )}
    </div>
  );
};

export default AwaitingStartNotice;
