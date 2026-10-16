import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { resolveLinkedLesson } from "@/lib/linked-lesson";
import type { PlanLesson } from "@/lib/planned-assignment";
import { useToast } from "@/hooks/use-toast";

/** „Připravit se“: jedna lekce se otevře hned, u více lekcí nabídne seznam (začni první). */
export default function PlanPrepareButton({ lessons, size = "sm" }: { lessons: PlanLesson[]; size?: "sm" | "default" }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (!lessons.length) return null;

  const open = async (l: PlanLesson) => {
    setBusy(l.id);
    const info = await resolveLinkedLesson(l.id, l.source).catch(() => null);
    setBusy(null);
    if (info) navigate(info.url);
    else toast({ title: "Lekci se nepodařilo otevřít", description: "Zkus to prosím později nebo se zeptej učitele.", variant: "destructive" });
  };

  if (lessons.length === 1) {
    return (
      <Button size={size} variant="outline" onClick={() => open(lessons[0])} disabled={!!busy}>
        {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <BookOpen className="w-3.5 h-3.5 mr-1" />} Připravit se
      </Button>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size={size} variant="outline"><BookOpen className="w-3.5 h-3.5 mr-1" /> Připravit se ({lessons.length} lekce)</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="end">
        <p className="px-2 py-1 text-xs text-muted-foreground">Projdi lekce postupně. V každé najdeš studijní lištu: Kartičky, Kvíz, Shrnutí.</p>
        <ol className="space-y-1">
          {lessons.map((l, i) => (
            <li key={l.id}>
              <button type="button" onClick={() => open(l)} disabled={!!busy}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="w-5 shrink-0 text-xs font-mono text-muted-foreground">{i + 1}.</span>
                <span className="min-w-0 flex-1 break-words">{l.title}</span>
                {i === 0 && <span className="shrink-0 text-xs font-medium text-primary">Začni zde</span>}
                {busy === l.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              </button>
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  );
}
