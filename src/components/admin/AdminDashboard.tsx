import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, UserCheck, School, BookOpen, Activity, TrendingUp,
  Clock, Plus, CheckCheck, Sparkles,
} from "lucide-react";

interface DashboardStats {
  totalStudents: number;
  pendingStudents: number;
  totalClasses: number;
  publishedLessons: number;
  completedActivities: number;
  avgSuccess: number;
}

interface RecentStudent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  status: string;
}

interface RecentActivity {
  user_name: string;
  activity_type: string;
  score: number;
  max_score: number;
  completed_at: string;
}

const activityTypeLabels: Record<string, string> = {
  quiz: "Kvíz",
  true_false: "Pravda/nepravda",
  matching: "Přiřazování",
  sorting: "Třídění",
  ordering: "Řazení",
  fill_blanks: "Doplňování",
  fill_choice: "Doplňování z nabídky",
  flashcards: "Kartičky",
  crossword: "Křížovka",
  memory_game: "Pexeso",
  image_hotspot: "Klikni správně",
  image_label: "Popis obrázku",
  reveal_cards: "Otevři kartičku",
};

interface Props {
  onNavigate: (tab: string) => void;
}

const AdminDashboard = ({ onNavigate }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    pendingStudents: 0,
    totalClasses: 0,
    publishedLessons: 0,
    completedActivities: 0,
    avgSuccess: 0,
  });
  const [recentRegistrations, setRecentRegistrations] = useState<RecentStudent[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);

    // Fetch all data in parallel
    const [
      { data: profiles },
      { data: classes },
      { data: lessons },
      { data: activities },
      { data: recentProfiles },
    ] = await Promise.all([
      supabase.from("profiles").select("id, status"),
      supabase.from("classes").select("id").eq("archived", false),
      supabase.from("textbook_lessons").select("id").eq("status", "published"),
      supabase.from("student_activity_results").select("user_id, score, max_score, completed_at"),
      supabase.from("profiles").select("id, first_name, last_name, email, created_at, status").order("created_at", { ascending: false }).limit(5),
    ]);

    const totalStudents = profiles?.length ?? 0;
    const pendingStudents = profiles?.filter((p: any) => p.status === "pending").length ?? 0;

    let totalScore = 0, totalMax = 0;
    activities?.forEach((a: any) => {
      totalScore += a.score;
      totalMax += a.max_score;
    });

    setStats({
      totalStudents,
      pendingStudents,
      totalClasses: classes?.length ?? 0,
      publishedLessons: lessons?.length ?? 0,
      completedActivities: activities?.length ?? 0,
      avgSuccess: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
    });

    setRecentRegistrations((recentProfiles ?? []).map((p: any) => ({ ...p, status: p.status as string })));

    // Recent activities with user names
    if (activities && activities.length > 0) {
      const sorted = [...activities].sort((a: any, b: any) =>
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      ).slice(0, 5);

      const userIds = [...new Set(sorted.map((a: any) => a.user_id))];
      const { data: activityProfiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", userIds);

      const nameMap = new Map(activityProfiles?.map((p: any) => [p.id, `${p.first_name} ${p.last_name}`]) ?? []);

      setRecentActivities(sorted.map((a: any) => ({
        user_name: nameMap.get(a.user_id) || "Neznámý",
        activity_type: a.activity_type || "",
        score: a.score,
        max_score: a.max_score,
        completed_at: a.completed_at,
      })));
    }

    setLoading(false);
  };

  const approveAllPending = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({ status: "approved" as any })
      .eq("status", "pending" as any);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Hotovo", description: `Všichni čekající studenti byli schváleni.` });
    fetchDashboard();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

  const successColor = (pct: number) =>
    pct >= 80 ? "text-green-400" : pct >= 50 ? "text-yellow-400" : pct > 0 ? "text-red-400" : "text-muted-foreground";

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    approved: "bg-green-500/20 text-green-400 border-green-500/30",
    blocked: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const statusLabels: Record<string, string> = {
    pending: "Čeká",
    approved: "Schválený",
    blocked: "Blokovaný",
  };

  if (loading) return <div className="text-muted-foreground p-4">Načítání dashboardu...</div>;

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={Users}
          label="Studenti"
          value={stats.totalStudents}
          onClick={() => onNavigate("users")}
        />
        <StatCard
          icon={UserCheck}
          label="Čekající"
          value={stats.pendingStudents}
          highlight={stats.pendingStudents > 0}
          onClick={() => onNavigate("users")}
        />
        <StatCard
          icon={School}
          label="Třídy"
          value={stats.totalClasses}
          onClick={() => onNavigate("classes")}
        />
        <StatCard
          icon={BookOpen}
          label="Publikované lekce"
          value={stats.publishedLessons}
          onClick={() => onNavigate("lessons")}
        />
        <StatCard
          icon={Activity}
          label="Dokončené aktivity"
          value={stats.completedActivities}
          onClick={() => onNavigate("results")}
        />
        <StatCard
          icon={TrendingUp}
          label="Ø Úspěšnost"
          value={stats.avgSuccess > 0 ? `${stats.avgSuccess} %` : "–"}
          valueClass={successColor(stats.avgSuccess)}
          onClick={() => onNavigate("results")}
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Rychlé akce</h2>
        <div className="flex flex-wrap gap-2">
          {stats.pendingStudents > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10" onClick={approveAllPending}>
              <CheckCheck className="w-4 h-4" />
              Schválit čekající ({stats.pendingStudents})
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onNavigate("textbooks")}>
            <Plus className="w-4 h-4" /> Přidat lekci
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onNavigate("classes")}>
            <School className="w-4 h-4" /> Spravovat třídy
          </Button>
        </div>
      </div>

      {/* Two columns: recent registrations + recent activities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent registrations */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-card px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Poslední registrace
            </h3>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onNavigate("users")}>
              Vše
            </Button>
          </div>
          <div className="divide-y divide-border">
            {recentRegistrations.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center">Žádné registrace.</p>
            ) : (
              recentRegistrations.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.first_name} {s.last_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={`text-xs ${statusColors[s.status] || ""}`}>
                      {statusLabels[s.status] || s.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(s.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent activities */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-card px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              Poslední aktivity studentů
            </h3>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onNavigate("results")}>
              Vše
            </Button>
          </div>
          <div className="divide-y divide-border">
            {recentActivities.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center">Zatím žádné aktivity.</p>
            ) : (
              recentActivities.map((a, i) => {
                const pct = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0;
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.user_name}</p>
                      <p className="text-xs text-muted-foreground">{activityTypeLabels[a.activity_type] || a.activity_type}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-medium ${successColor(pct)}`}>{pct} %</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(a.completed_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  highlight,
  valueClass,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  highlight?: boolean;
  valueClass?: string;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${
      highlight ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-card"
    }`}
  >
    <Icon className={`w-5 h-5 mb-2 ${highlight ? "text-yellow-400" : "text-muted-foreground"}`} />
    <p className={`text-2xl font-bold ${valueClass || "text-foreground"}`}>{value}</p>
    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
  </button>
);

export default AdminDashboard;
