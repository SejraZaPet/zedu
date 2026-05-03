import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Library } from "lucide-react";
import { useTeacherClasses } from "@/hooks/useTeacherClasses";

const colorForLabel = (s: string) => {
  const palette = ["#6EC6D9", "#9B6CFF", "#F472B6", "#F87171", "#FB923C", "#FBBF24", "#34D399", "#60A5FA", "#A3A3A3"];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

interface SubjectClassEntry {
  classId: string;
  className: string;
  subjectLabel: string;
  abbreviation: string;
  color: string;
  room: string;
}

const TeacherSubjects = () => {
  const navigate = useNavigate();
  const { classes, loading: loadingClasses } = useTeacherClasses();
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  useEffect(() => {
    if (loadingClasses) return;
    if (classes.length === 0) {
      setSlots([]);
      setLoadingSlots(false);
      return;
    }
    supabase
      .from("class_schedule_slots")
      .select("class_id, subject_label, abbreviation, color, room")
      .in("class_id", classes.map((c) => c.id))
      .then(({ data }) => {
        setSlots(data ?? []);
        setLoadingSlots(false);
      });
  }, [classes, loadingClasses]);

  const entries: SubjectClassEntry[] = useMemo(() => {
    const classMap = new Map(classes.map((c) => [c.id, c.name]));
    const seen = new Map<string, SubjectClassEntry>();
    for (const s of slots) {
      const label = (s.subject_label || "").trim();
      if (!label) continue;
      const key = `${s.class_id}::${label.toLowerCase()}`;
      if (seen.has(key)) continue;
      const className = classMap.get(s.class_id) || "";
      const abbr = (s.abbreviation || label.slice(0, 3)).toUpperCase();
      seen.set(key, {
        classId: s.class_id,
        className,
        subjectLabel: label,
        abbreviation: abbr,
        color: s.color || colorForLabel(label),
        room: s.room || "",
      });
    }
    return Array.from(seen.values()).sort((a, b) => {
      const c = a.subjectLabel.localeCompare(b.subjectLabel, "cs");
      if (c !== 0) return c;
      return a.className.localeCompare(b.className, "cs");
    });
  }, [slots, classes]);

  const loading = loadingClasses || loadingSlots;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-5xl"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/ucitel")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zpět na přehled
          </Button>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-brand flex items-center justify-center">
            <Library className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold">Moje předměty</h1>
            <p className="text-muted-foreground text-sm">
              Předměty přiřazené k vašim třídám podle rozvrhu
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-muted-foreground">Načítání...</div>
        ) : entries.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-muted-foreground">
              Zatím nemáte v rozvrhu žádné předměty. Přidejte je přes Rozvrh.
            </p>
            <Button className="mt-4" onClick={() => navigate("/ucitel/rozvrh")}>
              Otevřít rozvrh
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {entries.map((e) => (
              <button
                key={`${e.classId}-${e.subjectLabel}`}
                type="button"
                onClick={() =>
                  navigate(
                    `/ucitel/predmet/${encodeURIComponent(e.subjectLabel)}/trida/${e.classId}`,
                  )
                }
                title={`${e.subjectLabel} · ${e.className}${e.room ? ` · ${e.room}` : ""}`}
                className="text-left rounded-xl border border-border p-4 hover:border-primary/50 hover:shadow-sm transition-all bg-card"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-xs font-bold text-white px-2 py-1 rounded"
                    style={{ backgroundColor: e.color }}
                  >
                    {e.abbreviation}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {e.className}
                  </span>
                </div>
                <div className="text-sm font-medium truncate">{e.subjectLabel}</div>
                {e.room && (
                  <div className="text-xs text-muted-foreground mt-1">{e.room}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherSubjects;
