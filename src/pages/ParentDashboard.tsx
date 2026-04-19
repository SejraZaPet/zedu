import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User, BookOpen, BarChart3 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";

interface StudentInfo {
  id: string;
  first_name: string;
  last_name: string;
  school: string;
  year: number | null;
}

const ParentDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }

    const loadStudents = async () => {
      const { data: links } = await supabase
        .from("parent_student_links" as any)
        .select("student_id")
        .eq("parent_id", user.id);

      if (!links || links.length === 0) { setLoading(false); return; }

      const studentIds = links.map((l: any) => l.student_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, school, year")
        .in("id", studentIds);

      if (profiles) setStudents(profiles as StudentInfo[]);
      setLoading(false);
    };

    loadStudents();
  }, [authLoading, user, navigate]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
          <p className="text-muted-foreground">Načítání...</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 pb-16" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
        <div className="mb-8">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-2">
            Rodičovský přehled 👨‍👩‍👧
          </h1>
          <p className="text-muted-foreground">
            Sledujte výsledky a pokrok vašeho dítěte
          </p>
        </div>

        {students.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
              Žádné propojené dítě
            </h2>
            <p className="text-muted-foreground">
              Kontaktujte školu pro propojení s účtem vašeho dítěte.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {students.map((student) => (
              <div key={student.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-foreground">
                      {student.first_name} {student.last_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {student.school || "—"} · {student.year ? `${student.year}. ročník` : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/rodic/zak/${student.id}/ucebnice`)}>
                    <BookOpen className="w-4 h-4 mr-2" />
                    Učebnice
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/rodic/zak/${student.id}/vysledky`)}>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Výsledky
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default ParentDashboard;
