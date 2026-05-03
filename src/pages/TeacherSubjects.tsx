import { useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Library } from "lucide-react";
import { useTeacherSubjects } from "@/hooks/useTeacherSubjects";
import { useTeacherClasses } from "@/hooks/useTeacherClasses";

const colorForLabel = (s: string) => {
  const palette = ["#6EC6D9", "#9B6CFF", "#F472B6", "#F87171", "#FB923C", "#FBBF24", "#34D399", "#60A5FA", "#A3A3A3"];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

const pluralClasses = (n: number) =>
  n === 1 ? "třída" : n >= 2 && n <= 4 ? "třídy" : "tříd";

const TeacherSubjects = () => {
  const navigate = useNavigate();
  const { subjects, loading } = useTeacherSubjects();
  const { classes } = useTeacherClasses();

  const total = classes.length;

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
              Přehled všech předmětů, které vyučujete
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-muted-foreground">Načítání...</div>
        ) : subjects.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-muted-foreground">
              Zatím nemáte žádné předměty. Vytvořte učebnici a začněte učit.
            </p>
            <Button className="mt-4" onClick={() => navigate("/ucitel/ucebnice")}>
              Otevřít učebnice
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {subjects.map((s) => {
              const color = s.color || colorForLabel(s.label);
              const abbr = (s.abbreviation || s.label.slice(0, 3)).toUpperCase();
              return (
                <button
                  key={`${s.source}-${s.label}`}
                  type="button"
                  onClick={() =>
                    navigate(`/ucitel/ucebnice?predmet=${encodeURIComponent(s.label)}`)
                  }
                  title={s.label}
                  className="text-left rounded-xl border border-border p-4 hover:border-primary/50 hover:shadow-sm transition-all bg-card"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-xs font-bold text-white px-2 py-1 rounded"
                      style={{ backgroundColor: color }}
                    >
                      {abbr}
                    </span>
                  </div>
                  <div className="text-sm font-medium truncate">{s.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {total} {pluralClasses(total)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherSubjects;
