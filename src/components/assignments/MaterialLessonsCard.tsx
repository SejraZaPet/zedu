import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { resolveLinkedLesson } from "@/lib/linked-lesson";
import type { PlanLesson } from "@/lib/planned-assignment";
import { useToast } from "@/hooks/use-toast";

/** Materiál s více lekcemi: každá lekce jen k otevření, v pořadí od učitele. */
export default function MaterialLessonsCard({ lessons }: { lessons: PlanLesson[] }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const open = async (l: PlanLesson) => {
    setBusy(l.id);
    const info = await resolveLinkedLesson(l.id, l.source).catch(() => null);
    setBusy(null);
    if (info) navigate(info.url);
    else toast({ title: "Lekci se nepodařilo otevřít", description: "Zkus to prosím později nebo se zeptej učitele.", variant: "destructive" });
  };
  return (
    <Card className="mb-4">
      <CardContent className="p-4 space-y-2">
        <p className="text-sm font-medium">Lekce k otevření</p>
        <ol className="space-y-2">
          {lessons.map((l, i) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <span className="w-5 shrink-0 text-xs font-mono text-muted-foreground">{i + 1}.</span>
                <span className="min-w-0 break-words">{l.title}</span>
              </span>
              <Button size="sm" variant="outline" className="min-h-11" onClick={() => open(l)} disabled={!!busy}>
                {busy === l.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BookOpen className="w-4 h-4 mr-2" />}
                Otevřít lekci
              </Button>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
