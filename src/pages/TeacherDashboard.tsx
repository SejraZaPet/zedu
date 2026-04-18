import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User, GraduationCap, Sparkles, School, BarChart3 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  school: string;
}

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }

    supabase
      .from("profiles")
      .select("first_name, last_name, email, school")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as Profile);
        setLoading(false);
      });
  }, [authLoading, user, navigate]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Načítání...</div>
      </div>
    );
  }

  const isLektor = role === "lektor";

  const teacherCards = [
    {
      icon: GraduationCap,
      title: "Moje učebnice",
      description: "Spravujte a upravujte své digitální učebnice.",
      button: "Otevřít učebnice",
      onClick: () => navigate("/ucitel/ucebnice"),
    },
    {
      icon: Sparkles,
      title: "Moje aktivity",
      description: "Vytvářejte kvízy a interaktivní úkoly pro studenty.",
      button: "Otevřít aktivity",
      onClick: () => navigate("/ucitel/ucebnice"),
    },
    {
      icon: School,
      title: "Moje třídy",
      description: "Spravujte třídy a sledujte pokrok studentů.",
      button: "Spravovat třídy",
      onClick: () => navigate("/admin?tab=classes"),
    },
    {
      icon: BarChart3,
      title: "Výsledky studentů",
      description: "Sledujte úspěšnost a dokončené aktivity.",
      button: "Zobrazit výsledky",
      onClick: () => navigate("/admin?tab=results"),
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-5xl"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold">
            Ahoj, {profile?.first_name || (isLektor ? "lektore" : "učiteli")}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {isLektor ? "Lektorský panel" : "Učitelský panel"}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {teacherCards.map((card) => (
            <div
              key={card.title}
              className="bg-card border border-border rounded-xl p-6 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center">
                  <card.icon className="w-5 h-5 text-white" />
                </div>
                <h2 className="font-heading text-lg font-semibold">{card.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4 flex-1">{card.description}</p>
              <Button onClick={card.onClick} variant="outline" className="w-full">
                {card.button}
              </Button>
            </div>
          ))}

          {/* Profil */}
          <div className="bg-card border border-border rounded-xl p-6 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <h2 className="font-heading text-lg font-semibold">Můj profil</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm items-center">
              <div>
                <span className="text-muted-foreground block">Jméno</span>
                <span>{profile?.first_name} {profile?.last_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">E-mail</span>
                <span>{profile?.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Škola</span>
                <span>{profile?.school || "—"}</span>
              </div>
              <div>
                <Button onClick={() => navigate("/profil")} variant="outline" size="sm">
                  Upravit profil
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherDashboard;
