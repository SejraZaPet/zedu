import type { ReactNode } from "react";
import WorksheetPlayer from "@/components/WorksheetPlayer";
import type { WorksheetSpec } from "@/lib/worksheet-spec";
import { toast } from "@/hooks/use-toast";
import { submitWorksheetAttempt, type WsAssignmentLike, type WsAttemptLike } from "@/lib/worksheet-attempt";

/**
 * Sdílené vykreslení pracovního listu pro žáka (A4 „paper“):
 * - úkol: pokus z assignment_attempts, odevzdání přes submitWorksheetAttempt,
 * - vlastní práce: student_worksheet_work přes `work`.
 * Používá StudentAssignmentPlayer, StudentWorksheetView i digitální stránka sešitu.
 */
export type WorksheetPanelProps = {
  spec: WorksheetSpec;
  toolbar?: ReactNode;
} & (
  | {
      kind: "assignment";
      assignment: WsAssignmentLike;
      attempt: WsAttemptLike | null;
      studentId: string | null;
      locked: boolean;
      lockedMessage?: string | null;
      showResults?: boolean;
      gate: () => Promise<boolean>;
      onSubmitted: (score: number, maxScore: number) => void;
    }
  | {
      kind: "own";
      worksheetId: string;
      /** null = učitel / nepřihlášený: list se zobrazí bez ukládání. */
      studentId: string | null;
    }
);

export default function WorksheetPanel(props: WorksheetPanelProps) {
  const { spec, toolbar } = props;
  const variantId = spec.variants[0]?.variantId ?? "A";

  if (props.kind === "own") {
    return (
      <>
        {toolbar}
        <WorksheetPlayer
          spec={spec}
          variantId={variantId}
          attemptId={null}
          work={props.studentId ? { worksheetId: props.worksheetId, studentId: props.studentId, variantId } : null}
        />
      </>
    );
  }

  const { assignment, attempt, studentId } = props;
  return (
    <>
      {toolbar}
      <WorksheetPlayer
        key={attempt?.id ?? "no-attempt"}
        spec={spec}
        variantId={variantId}
        attemptId={attempt?.id ?? null}
        locked={props.locked}
        lockedMessage={props.lockedMessage ?? null}
        showResults={props.showResults}
        initialAnswers={(attempt?.answers as any) || {}}
        onSubmit={async (wAnswers, score, maxScore) => {
          if (!attempt || !studentId) return false;
          try {
            const res = await submitWorksheetAttempt({
              assignment, attemptId: attempt.id, studentId, answers: wAnswers as any, score, maxScore, gate: props.gate,
            });
            if (res === "gated") return false;
            if (res.ok === false) {
              toast({ title: res.title, description: res.message, variant: "destructive" });
              // Chyba uložení: chování jako dřív (bez návratu false).
              return res.title === "Chyba" ? undefined : false;
            }
            props.onSubmitted(score, maxScore);
            toast({ title: "Odevzdáno!", description: `Skóre: ${score}/${maxScore}` });
          } catch (e: any) {
            toast({ title: "Chyba", description: e?.message, variant: "destructive" });
          }
        }}
      />
    </>
  );
}
