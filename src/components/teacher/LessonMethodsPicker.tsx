import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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

  return (
    <div>
      <Label className="mb-2 block">Výukové metody u této lekce</Label>
      <p className="text-xs text-muted-foreground mb-2">
        Označte metody, které v lekci používáte. Zobrazí se ve vašem přehledu Studijních metod.
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Načítám metody…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {methods.map((m) => {
            const active = selected.includes(m.id);
            return (
              <label
                key={m.id}
                className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer text-sm ${
                  active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
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
              </label>
            );
          })}
          {methods.length === 0 && (
            <p className="text-sm text-muted-foreground">Katalog metod je prázdný.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default LessonMethodsPicker;
