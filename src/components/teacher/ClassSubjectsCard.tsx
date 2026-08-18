import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Loader2, ArrowRight } from "lucide-react";
import { useTeachingUnits } from "@/hooks/useTeachingUnits";

/**
 * Předměty vyučované v této třídě — čte vazby z `class_subjects`
 * (přes useTeachingUnits, tj. včetně kombinací odvozených z rozvrhu).
 * Klik otevře Výuku pro danou kombinaci předmět × třída.
 */
export default function ClassSubjectsCard({ classId }: { classId: string }) {
  const navigate = useNavigate();
  const { units, loading } = useTeachingUnits();

  const classUnits = useMemo(
    () => units.filter((u) => u.kind === "class" && u.targetId === classId),
    [units, classId],
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" /> Předměty
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate("/ucitel/skupiny")}>
          Spravovat <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Načítání…
          </div>
        ) : classUnits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Této třídě zatím není přiřazen žádný předmět.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {classUnits.map((u) => (
              <button
                key={u.key}
                type="button"
                onClick={() => navigate(u.path)}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-primary/50 transition-colors"
                title={`Výuka: ${u.subjectName} · ${u.targetName}`}
              >
                <span
                  className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: u.color }}
                >
                  {u.abbreviation}
                </span>
                {u.subjectName}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
