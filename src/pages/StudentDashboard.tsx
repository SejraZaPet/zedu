import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User, KeyRound, ClipboardList, Gamepad2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  school: string;
  field_of_study: string;
  year: number | null;
  username?: string;
  student_code?: string;
}

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
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
      .select("first_name, last_name, email, school, field_of_study, year, username, student_code")
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

  const studentCards = [
    {
      icon: KeyRound,
      title: "Moje učebnice",
      description: "Prohlédněte si učebnice, ke kterým máte přístup přes kód od učitele.",
      button: "Otevřít učebnice",
      onClick: () => navigate("/student/ucebnice"),
    },
    {
      icon: ClipboardList,
      title: "Moje úlohy",
      description: "Zobrazte zadané úlohy a sledujte své výsledky.",
      button: "Otevřít úlohy",
      onClick: () => navigate("/student/ulohy"),
    },
    {
      icon: Gamepad2,
      title: "Připojit se do hry",
      description: "Zapojte se do živé hry, kterou spustil váš učitel.",
      button: "Připojit se",
      onClick: () => navigate("/live/pripojit"),
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
            Ahoj, {profile?.first_name || "studente"}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">Studentský panel</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profil */}
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <h2 className="font-heading text-lg font-semibold">Můj profil</h2>
            </div>
            <div className="space-y-2 text-sm flex-1">
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
              {profile?.username && (
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Uživatelské jméno</span>
                  <span className="text-sm font-mono font-medium">{profile.username}</span>
                </div>
              )}
              {profile?.student_code && (
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Kód žáka</span>
                  <span className="text-sm font-mono font-bold text-primary">{profile.student_code}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Kód žáka předejte svému rodiči – zadá ho ve svém profilu pro sledování vašeho pokroku.
              </p>
            </div>
            <Button
              onClick={() => navigate("/profil")}
              variant="outline"
              size="sm"
              className="mt-4 w-full"
            >
              Upravit profil
            </Button>
          </div>

          {/* Akční karty */}
          {studentCards.map((card) => (
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
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default StudentDashboard;
