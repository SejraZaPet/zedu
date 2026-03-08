import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, BookOpen, User, GraduationCap, School, BarChart3, Sparkles } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  school: string;
  field_of_study: string;
  year: number | null;
  status: string;
}

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("user");

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const [profileRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("first_name, last_name, email, school, field_of_study, year, status")
          .eq("id", session.user.id)
          .single(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .limit(1),
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (rolesRes.data?.[0]) setRole(rolesRes.data[0].role);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/auth");
    });

    load();
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Načítání...</div>
      </div>
    );
  }

  const isTeacher = role === "teacher";

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
      onClick: () => navigate("/admin"),
    },
    {
      icon: BarChart3,
      title: "Výsledky studentů",
      description: "Sledujte úspěšnost a dokončené aktivity.",
      button: "Zobrazit výsledky",
      onClick: () => navigate("/admin"),
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold">
              Ahoj, {profile?.first_name || (isTeacher ? "učiteli" : "studente")}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              {isTeacher ? "Učitelský panel" : "Studentský panel"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Odhlásit
          </Button>
        </div>

        {isTeacher ? (
          <div className="grid gap-6 md:grid-cols-2">
            {teacherCards.map((card) => (
              <div key={card.title} className="bg-card border border-border rounded-xl p-6 flex flex-col">
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

            {/* Profile card */}
            <div className="bg-card border border-border rounded-xl p-6 md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <h2 className="font-heading text-lg font-semibold">Můj profil</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Profile card */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-heading text-lg font-semibold">Můj profil</h2>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jméno</span>
                  <span>{profile?.first_name} {profile?.last_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">E-mail</span>
                  <span>{profile?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Škola</span>
                  <span>{profile?.school || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Obor</span>
                  <span>{profile?.field_of_study || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ročník</span>
                  <span>{profile?.year ?? "—"}</span>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-heading text-lg font-semibold">Učebnice</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Pokračuj ve studiu z virtuálních učebnic.
              </p>
              <Button onClick={() => navigate("/ucebnice")} variant="outline" className="w-full">
                Přejít na učebnice
              </Button>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default StudentDashboard;
