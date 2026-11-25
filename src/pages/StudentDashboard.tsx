import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ensureMyCourseNotebooks } from "@/lib/notebook";
import { Button } from "@/components/ui/button";
import {
  User,
  Book,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Flame,
  FolderOpen,
  Gamepad2,
  GraduationCap,
  Library,
  NotebookText,
  Sparkles,
  SquareCheckBig,
  Trophy,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TodayWidget from "@/components/calendar/TodayWidget";
import DashboardGreetingHeader from "@/components/dashboard/DashboardGreetingHeader";
import BannersNewsButton from "@/components/dashboard/BannersNewsButton";
import ProfileAvatarBubble from "@/components/profile/ProfileAvatarBubble";
import { StudentDashboardCompactTile, StudentDashboardTile } from "@/components/dashboard/StudentDashboardTile";
import { useAuth } from "@/contexts/AuthContext";
import { fetchStudentCourses } from "@/lib/student-courses";
import { czechDays, loadStudentDashboardSummary, type StudentDashboardSummary } from "@/lib/student-dashboard-summary";
import { useStudentPracticeLessons } from "@/hooks/useStudentPracticeLessons";

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
  useStudentPracticeLessons(user?.id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null);
  const [assignmentsCount, setAssignmentsCount] = useState<number | null>(null);
  const [subjectNewsCount, setSubjectNewsCount] = useState<number | null>(null);
  const [classLabel, setClassLabel] = useState("—");
  const [summary, setSummary] = useState<StudentDashboardSummary | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // Jeden souhrnný výpočet přes všechny předměty (žádné dotazy po kartách).
    fetchStudentCourses(user.id)
      .then((rows) => {
        if (cancelled) return;
        setSubjectNewsCount(rows.reduce((sum, course) => sum + course.news.total, 0) || null);
        const names = [...new Set(rows.filter((course) => course.audienceKind === "class").map((course) => course.audienceName))];
        setClassLabel(names.length === 0 ? "—" : names.length === 1 ? names[0] : `${names[0]} +${names.length - 1} další`);
      })
      .catch(() => { if (!cancelled) setSubjectNewsCount(null); });
    loadStudentDashboardSummary(user.id)
      .then((value) => { if (!cancelled) setSummary(value); })
      .catch(() => { if (!cancelled) setSummary(null); });
    return () => { cancelled = true; };
  }, [user]);

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
      id: "subjects",
      icon: Library,
      title: "Moje předměty",
      description: "Třídy a kurzy",
      to: "/student/predmety",
      tone: "subjects" as const,
      count: subjectNewsCount,
      countLabel: "počet novinek",
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
        <DashboardGreetingHeader
          showBanners={!!user}
          actions={user ? <BannersNewsButton /> : undefined}
          identity={
            <div className="flex flex-wrap items-center gap-5">
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
            {summary && (
              <div className="mt-3 flex flex-wrap gap-2" aria-label="Herní profil">
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                  Série · {czechDays(summary.streakDays)}
                </span>
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                  Úroveň · {summary.level}
                </span>
              </div>
            )}
          </div>
            </div>
          }
        />

        <div data-testid="student-dashboard-stack">
          <div data-testid="student-today-slot">
            <TodayWidget
              role="student"
              onOpenAssignmentsChange={setAssignmentsCount}
              onUpcomingExamsChange={setUpcomingCount}
            />
          </div>

          <section className="dashboard-main-grid student-dashboard-main-grid" aria-label="Hlavní odkazy" data-testid="student-main-links">
            {mainTiles.map((tile) => <StudentDashboardTile key={tile.id} {...tile} />)}
          </section>

          <section className="dashboard-compact-grid" aria-label="Další odkazy" data-testid="student-compact-links">
            {compactTiles.map((tile) => <StudentDashboardCompactTile key={tile.id} {...tile} />)}
          </section>

          <div className="mb-6 grid gap-4 md:grid-cols-2" data-testid="student-profile-summary">
            <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="student-profile-heading">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand-sm">
                  <User className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                </div>
                <h2 id="student-profile-heading" className="font-heading text-lg font-semibold">Můj profil</h2>
              </div>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Jméno</dt>
                <dd className="min-w-0 break-words text-right font-medium">{[profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "—"}</dd>
                <dt className="text-muted-foreground">Škola</dt>
                <dd className="min-w-0 break-words text-right">{profile?.school || "—"}</dd>
                <dt className="text-muted-foreground">Třída</dt>
                <dd className="min-w-0 break-words text-right">{classLabel}</dd>
                <dt className="text-muted-foreground">Kód žáka</dt>
                <dd className="break-all text-right font-mono font-bold text-primary">{profile?.student_code || "—"}</dd>
              </dl>
              <Button onClick={() => navigate("/profil")} variant="outline" size="sm" className="mt-4 min-h-11 w-full">
                Upravit profil
              </Button>
            </section>

            <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="student-progress-heading">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand-sm">
                  <Sparkles className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                </div>
                <h2 id="student-progress-heading" className="font-heading text-lg font-semibold">Můj pokrok</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Trophy className="h-4 w-4 text-primary" aria-hidden="true" />XP</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{summary?.xp ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Flame className="h-4 w-4 text-primary" aria-hidden="true" />Série</div>
                  <div className="mt-1 text-lg font-bold">{summary ? czechDays(summary.streakDays) : "—"}</div>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/10 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />Průměr · 30 dní</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">{summary?.monthAvgPct == null ? "—" : `${summary.monthAvgPct} %`}</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default StudentDashboard;
