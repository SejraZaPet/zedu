import { useState } from "react";
import { CheckCircle2, XCircle, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActivityAnswer } from "@/lib/activity-answers";

/** Plain React text keeps saved lesson content safe, without HTML injection. */
export function ActivityAnswerReview({ answers }: { answers: ActivityAnswer[] }) {
  const [open, setOpen] = useState(false);
  return <div className="space-y-3">
    <Button size="sm" variant="outline" onClick={() => setOpen(!open)} aria-expanded={open}>
      <ListChecks className="mr-2 h-4 w-4" />{open ? "Skrýt odpovědi" : "Zkontrolovat odpovědi"}
    </Button>
    {open && <ol className="space-y-3" aria-label="Kontrola odpovědí">
      {answers.map((answer) => <li key={answer.index} className="border border-border rounded-md p-3 space-y-2 break-words">
        <div className="flex items-start gap-2">
          {answer.correct ? <CheckCircle2 aria-label="Správně" className="h-5 w-5 shrink-0 text-activity-correct" /> : <XCircle aria-label="Nesprávně" className="h-5 w-5 shrink-0 text-destructive" />}
          <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{answer.index + 1}. {answer.text}</p>
        </div>
        <p className="text-sm text-foreground">Tvoje odpověď: {answer.studentAnswer || "Bez odpovědi"}</p>
        <p className="text-sm text-foreground">Správná odpověď: {answer.correctAnswer}</p>
        {answer.explanation && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{answer.explanation}</p>}
      </li>)}
    </ol>}
  </div>;
}