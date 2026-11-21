import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ensureMyCourseNotebooks } from "@/lib/notebook";
import { Button } from "@/components/ui/button";
import {
  User,
  Book,
  CalendarDays,
  ClipboardCheck,
  FolderOpen,
  Gamepad2,
  GraduationCap,
  NotebookText,
  SquareCheckBig,
  Trophy,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TodayWidget from "@/components/calendar/TodayWidget";
import StudentProgressWidgets from "@/components/student/StudentProgressWidgets";
import PlayerProfileWidget from "@/components/student/PlayerProfileWidget";
import MyLeagueCard from "@/components/student/MyLeagueCard";
import DashboardBanners from "@/components/dashboard/DashboardBanners";
import BannersNewsButton from "@/components/dashboard/BannersNewsButton";
import ProfileAvatarBubble from "@/components/profile/ProfileAvatarBubble";
import RecognitionWidget from "@/components/behavior/RecognitionWidget";
import UpcomingExamsCard from "@/components/student/UpcomingExamsCard";
import { StudentDashboardCompactTile, StudentDashboardTile } from "@/components/dashboard/StudentDashboardTile";
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
  useEffect(() => { void ensureMyCourseNotebooks(); }, []);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null);
  const [assignmentsCount, setAssignmentsCount] = useState<number | null>(null);

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

  const mainTiles = [
    {
      id: "learn",
      icon: GraduationCap,
      title: "Učím se",
      description: "Kartičky, kvízy a příprava na test z látky tvého učitele",
      to: "/student/metody",
      tone: "learn" as const,
      count: upcomingCount,
      wide: true,
    },
    {
      id: "textbooks",
      icon: Book,
      title: "Učebnice",
      description: "Lekce a texty",
      to: "/student/ucebnice",
      tone: "textbooks" as const,
    },
    {
      id: "assignments",
      icon: SquareCheckBig,
      title: "Úlohy",
      description: "Zadané a odevzdané",
      to: "/student/ulohy",
      tone: "assignments" as const,
      count: assignmentsCount,
    },
    {
      id: "notebook",
      icon: NotebookText,
      title: "Sešit",
      description: "Moje poznámky",
      to: "/student/sesit",
      tone: "notebook" as const,
    },
    {
      id: "portfolio",
      icon: FolderOpen,
      title: "Portfolio",
      description: "Moje práce",
      to: "/student/portfolio",
      tone: "portfolio" as const,
    },
    {
      id: "schedule",
      icon: CalendarDays,
      title: "Rozvrh",
      description: "Hodiny a termíny",
      to: "/student/rozvrh",
      tone: "schedule" as const,
    },
  ];

  const compactTiles = [
    { id: "join-game", icon: Gamepad2, title: "Připojit se do hry", to: "/live/pripojit" },
    { id: "todos", icon: ClipboardCheck, title: "Moje úkoly", to: "/todo" },
    { id: "books", icon: Book, title: "Knihy", to: "/student/knihy" },
    { id: "academy", icon: GraduationCap, title: "Akademie", to: "/student/akademie" },
    { id: "leaderboard", icon: Trophy, title: "Žebříček", to: "/student/zebricek" },
    { id: "from-material", icon: FolderOpen, title: "Z materiálu", to: "/student/z-materialu" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-6xl overflow-x-clip"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        <div className="mb-8 flex flex-wrap items-center gap-5">
          <ProfileAvatarBubble
            userId={user?.id ?? null}
            size={96}
            crop="head"
            shape="square"
            showEditButton={false}
          />

          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-3xl font-bold">
              Ahoj, {profile?.first_name || "studente"}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">Studentský panel</p>
          </div>
          {user && <BannersNewsButton />}
        </div>

        {user && <DashboardBanners />}

        <div className="flex flex-col md:block" data-testid="student-dashboard-stack">
          <div className="max-md:order-first" data-testid="student-today-slot">
            <TodayWidget role="student" onOpenAssignmentsChange={setAssignmentsCount} />
          </div>

          <section className="student-dashboard-main-grid" aria-label="Hlavní odkazy" data-testid="student-main-links">
            {mainTiles.map((tile) => <StudentDashboardTile key={tile.id} {...tile} />)}
          </section>

          <section className="student-dashboard-compact-grid" aria-label="Další odkazy" data-testid="student-compact-links">
            {compactTiles.map((tile) => <StudentDashboardCompactTile key={tile.id} {...tile} />)}
          </section>

          {user && <UpcomingExamsCard userId={user.id} onCountChange={setUpcomingCount} />}
          {user && <MyLeagueCard />}

          {user && (
            <PlayerProfileWidget
              userId={user.id}
              firstName={profile?.first_name}
              lastName={profile?.last_name}
            />
          )}

          {user && <StudentProgressWidgets userId={user.id} />}

          {user && (
            <div className="mb-6">
              <RecognitionWidget studentId={user.id} />
            </div>
          )}
        </div>

        <section className="bg-card border border-border rounded-xl p-6" aria-labelledby="student-profile-heading">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <h2 id="student-profile-heading" className="font-heading text-lg font-semibold">Můj profil</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap justify-between gap-x-4">
              <span className="text-muted-foreground">Jméno</span>
              <span className="min-w-0 break-words text-right">{profile?.first_name} {profile?.last_name}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4">
              <span className="text-muted-foreground">E-mail</span>
              <span className="min-w-0 break-all text-right">{profile?.email}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4">
              <span className="text-muted-foreground">Škola</span>
              <span className="min-w-0 break-words text-right">{profile?.school || "—"}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4">
              <span className="text-muted-foreground">Obor</span>
              <span className="min-w-0 break-words text-right">{profile?.field_of_study || "—"}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4">
              <span className="text-muted-foreground">Ročník</span>
              <span>{profile?.year ?? "—"}</span>
            </div>
            {profile?.username && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Uživatelské jméno</span>
                <span className="text-sm font-mono font-medium break-all">{profile.username}</span>
              </div>
            )}
            {profile?.student_code && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 py-2 border-b border-border">
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
            className="mt-4 w-full min-h-11"
          >
            Upravit profil
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default StudentDashboard;
