import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Method {
  id: string;
  name: string;
  category: string | null;
}

interface Props {
  lessonId: string;
  /** Zdrojová tabulka lekce – rozhoduje, do kterého pole vazby se ukládá. */
  source: "textbook_lessons" | "teacher_textbook_lessons";
}

/** Přiřazení výukových metod ke konkrétní lekci (vazba lesson_method_links.lesson_id). */
const LessonMethodsPicker = ({ lessonId, source }: Props) => {
  const column = source === "teacher_textbook_lessons" ? "lesson_id" : "catalog_lesson_id";
  const { toast } = useToast();
  const [methods, setMethods] = useState<Method[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [methodsRes, linksRes] = await Promise.all([
        supabase.from("learning_methods").select("id, name, category").order("name"),
        supabase.from("lesson_method_links").select("method_id").eq(column, lessonId),
      ]);
      if (cancelled) return;
      setMethods(((methodsRes.data as any[]) ?? []) as Method[]);
      setSelected(((linksRes.data as any[]) ?? []).map((l) => l.method_id));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, column]);

  const toggle = async (methodId: string) => {
    const isOn = selected.includes(methodId);
    setBusyId(methodId);
    try {
      if (isOn) {
        const { error } = await supabase
          .from("lesson_method_links")
          .delete()
          .eq(column, lessonId)
          .eq("method_id", methodId);
        if (error) throw error;
        setSelected((prev) => prev.filter((x) => x !== methodId));
      } else {
        const { error } = await supabase
          .from("lesson_method_links")
          .insert({
            [column]: lessonId,
            method_id: methodId,
            ...(column === "catalog_lesson_id"
              ? { created_by: (await supabase.auth.getUser()).data.user?.id }
              : {}),
          } as any);
        if (error) throw error;
        setSelected((prev) => [...prev, methodId]);
      }
    } catch (err: any) {
      toast({
        title: "Metodu se nepodařilo uložit",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const triggerLabel =
    selected.length === 0
      ? "Vybrat výukové metody"
      : `Výukové metody (${selected.length} ${selected.length === 1 ? "vybraná" : "vybrané"})`;

  return (
    <div>
      <Label className="mb-1.5 block">Výukové metody u této lekce</Label>
      <p className="text-xs text-muted-foreground mb-2">
        Označte metody, které v lekci používáte. Zobrazí se ve vašem přehledu Studijních metod.
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Načítám metody…
        </div>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-10 w-full justify-between px-3 font-normal">
              <span className="truncate text-left">{triggerLabel}</span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-2">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <div className="text-sm font-medium">Výukové metody</div>
              {selected.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => Promise.all(selected.map((id) => toggle(id)))}
                >
                  Vymazat
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-72">
              <div className="space-y-1 p-1">
                {methods.map((m) => {
                  const active = selected.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/60",
                        active && "bg-muted/50",
                      )}
                    >
                      <Checkbox
                        checked={active}
                        disabled={busyId === m.id}
                        onCheckedChange={() => toggle(m.id)}
                      />
                      <span className="flex-1">{m.name}</span>
                      {m.category && (
                        <Badge variant="secondary" className="text-xs">
                          {m.category}
                        </Badge>
                      )}
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </label>
                  );
                })}
                {methods.length === 0 && (
                  <p className="text-sm text-muted-foreground px-2 py-2">
                    Katalog metod je prázdný.
                  </p>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default LessonMethodsPicker;
