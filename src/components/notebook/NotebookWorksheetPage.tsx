import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ExternalLink, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import WorksheetPanel from "@/components/worksheet/WorksheetPanel";
import type { WorksheetSpec } from "@/lib/worksheet-spec";
import { worksheetLinkHref, type NotebookWorksheetRef } from "@/lib/worksheet-notebook";
import {
  checkLessonGate, isDeadlinePassed, loadOrCreateIndividualAttempt, revealsCorrectAnswers,
  type WsAssignmentLike, type WsAttemptLike,
} from "@/lib/worksheet-attempt";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; spec: WorksheetSpec; assignment: WsAssignmentLike | null; attempt: WsAttemptLike | null; note?: string };

/** Digitální stránka sešitu: list vykreslený přímo na A4 se stejnými odpověďmi jako mimo sešit. */
export default function NotebookWorksheetPage({
  worksheetRef: wsRef, userId, isStudent,
}: { worksheetRef: NotebookWorksheetRef; userId: string; isStudent: boolean }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { data: w } = await supabase.from("worksheets" as any).select("spec").eq("id", wsRef.worksheetId).maybeSingle();
      const spec = (w as any)?.spec as WorksheetSpec | undefined;
      if (!spec || !spec.version) {
        setState({ status: "error", message: "Pracovní list teď není dostupný. Možná ho učitel skryl nebo smazal." });
        return;
      }
      if (!wsRef.assignmentId || !isStudent) {
        setState({ status: "ready", spec, assignment: null, attempt: null });
        return;
      }
      const { data: a } = await supabase.from("assignments" as any).select("*").eq("id", wsRef.assignmentId).maybeSingle();
      if (!a) {
        setState({ status: "error", message: "Úkol k tomuto listu už není dostupný." });
        return;
      }
      const assignment = a as any as WsAssignmentLike;
      if ((assignment.group_mode ?? "individual") !== "individual" || assignment.lockdown_mode) {
        setState({ status: "error", message: "Tento úkol se vyplňuje jen v úkolu (skupinový nebo uzamčený režim). Otevři ho tlačítkem „Otevřít na A4“." });
        return;
      }
      const { attempt, decision } = await loadOrCreateIndividualAttempt(assignment, userId);
      if (!attempt && decision.kind === "view" && decision.reason === "deadline") {
        setState({ status: "error", message: "Termín úkolu vypršel a nic jsi neodevzdal(a). Pokud potřebuješ víc času, napiš učiteli." });
        return;
      }
      const note = decision.kind === "view" && decision.reason === "exhausted" ? "Všechny pokusy jsou vyčerpané, zobrazuje se nejlepší pokus." : undefined;
      setState({ status: "ready", spec, assignment, attempt, note });
    } catch (e: any) {
      setState({ status: "error", message: e?.message ? `List se nepodařilo načíst: ${e.message}` : "List se nepodařilo načíst." });
    }
  }, [wsRef.worksheetId, wsRef.assignmentId, userId, isStudent]);

  useEffect(() => { void load(); }, [load]);

  const toolbar = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="h-4 w-4" aria-hidden />
        <span className="font-medium text-foreground">{wsRef.title}</span>
        {wsRef.assignmentId ? "· úkol" : "· vlastní práce"}
      </p>
      <Button asChild size="sm" variant="outline" className="gap-1">
        <Link to={worksheetLinkHref(wsRef)}><ExternalLink className="h-3.5 w-3.5" /> Otevřít na A4</Link>
      </Button>
    </div>
  );

  if (state.status === "loading") {
    return <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Načítám list…</div>;
  }
  if (state.status === "error") {
    return (
      <div>
        {toolbar}
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="space-y-2">
            <p>{state.message}</p>
            <Button size="sm" variant="outline" onClick={() => void load()}>Zkusit znovu</Button>
          </div>
        </div>
      </div>
    );
  }

  const { spec, assignment, attempt } = state;
  if (!assignment) {
    return <WorksheetPanel kind="own" spec={spec} worksheetId={wsRef.worksheetId} studentId={isStudent ? userId : null} toolbar={toolbar} />;
  }
  const deadline = isDeadlinePassed(assignment.deadline);
  const locked = attempt?.status !== "in_progress" || deadline;
  return (
    <>
      {state.note && <p className="mb-2 text-sm text-muted-foreground">{state.note}</p>}
      <WorksheetPanel
        kind="assignment"
        spec={spec}
        assignment={assignment}
        attempt={attempt}
        studentId={userId}
        locked={locked}
        lockedMessage={deadline && attempt?.status === "in_progress"
          ? "Termín vypršel – odpovědi už nelze měnit ani odevzdat. Pokud potřebuješ víc času, napiš učiteli."
          : null}
        showResults={locked && !!attempt && revealsCorrectAnswers(assignment)}
        toolbar={toolbar}
        gate={async () => {
          if (!assignment.lesson_id) return true;
          try {
            const g = await checkLessonGate(assignment.lesson_id, assignment.lesson_source ?? null, userId);
            if (g && g.done < g.total) {
              toast({ title: "Úlohu zatím nelze odevzdat", description: `Nejdřív dokonči povinné aktivity lekce: ${g.done} z ${g.total}.`, variant: "destructive" });
              return false;
            }
          } catch (e) { console.warn("[lesson gate] check failed", e); }
          return true;
        }}
        onSubmitted={(score, maxScore) => {
          if (attempt) setState({ ...state, attempt: { ...attempt, status: "submitted", score, max_score: maxScore } });
        }}
      />
    </>
  );
}
