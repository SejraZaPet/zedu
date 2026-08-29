import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Users, GraduationCap, CalendarDays, Activity, BadgeCheck } from "lucide-react";

interface RoleStat {
  total: number;
  active_30d: number;
  inactive_30d: number;
  not_approved: number;
}

interface Overview {
  users_total: number;
  roles: Record<string, RoleStat>;
  signins: { last_7d: number; last_30d: number; never: number };
  license: null | {
    plan: string | null;
    status: string | null;
    expires_at: string | null;
    seats_teachers: number | null;
    seats_students: number | null;
    teachers_used: number;
    students_used: number;
  };
  activity: Record<string, number>;
  reservations: {
    pending: number;
    upcoming_7d: number;
    resources_total: number;
    top_resources_week: { name: string; type: string; reservations: number; hours: number | string }[];
  };
}

const ROLE_LABELS: Record<string, string> = {
  teacher: "Učitelé",
  user: "Žáci",
  lektor: "Lektoři",
  rodic: "Rodiče",
  school_admin: "Správci školy",
};

const Stat = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-2xl font-semibold font-heading">{value}</div>
    {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
  </div>
);

const SeatBar = ({ label, used, seats }: { label: string; used: number; seats: number | null }) => {
  const pct = seats && seats > 0 ? Math.min(100, Math.round((used / seats) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {used} / {seats ?? "—"}
        </span>
      </div>
      <Progress value={pct} />
    </div>
  );
};

const SchoolOverviewTab = ({ schoolId }: { schoolId: string }) => {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: res, error } = await supabase.rpc("school_overview_stats", { _school_id: schoolId });
      if (cancelled) return;
      if (error) setError(error.message);
      else setData(res as unknown as Overview);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  if (loading) {
    return (
      <div className="py-10 flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Načítám přehled…
      </div>
    );
  }
  if (error || !data) {
    return <p className="py-8 text-sm text-destructive">Přehled se nepodařilo načíst: {error ?? "žádná data"}</p>;
  }

  const a = data.activity ?? {};

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Uživatelé školy ({data.users_total})
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data.roles ?? {}).map(([role, stat]) => (
            <div key={role} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{ROLE_LABELS[role] ?? role}</span>
                <span className="text-xl font-semibold">{stat.total}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Aktivní (30 dní): <strong>{stat.active_30d}</strong> · Bez přihlášení: {stat.inactive_30d}
              </div>
              {stat.not_approved > 0 && (
                <Badge variant="outline" className="mt-2 text-xs">
                  {stat.not_approved} čeká na schválení
                </Badge>
              )}
            </div>
          ))}
          {Object.keys(data.roles ?? {}).length === 0 && (
            <p className="text-sm text-muted-foreground">Ve škole nejsou žádní uživatelé s rolí.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-primary" /> Využití licence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.license ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge>{data.license.plan ?? "—"}</Badge>
                <Badge variant="outline">{data.license.status ?? "—"}</Badge>
                {data.license.expires_at && (
                  <span className="text-muted-foreground">
                    platnost do {new Date(data.license.expires_at).toLocaleDateString("cs-CZ")}
                  </span>
                )}
              </div>
              <SeatBar label="Učitelé" used={data.license.teachers_used} seats={data.license.seats_teachers} />
              <SeatBar label="Žáci" used={data.license.students_used} seats={data.license.seats_students} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Škola nemá evidovanou licenci.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Aktivita školy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Přihlášení za 7 dní" value={data.signins.last_7d} hint="unikátní uživatelé" />
            <Stat label="Přihlášení za 30 dní" value={data.signins.last_30d} hint="unikátní uživatelé" />
            <Stat label="Nikdy se nepřihlásili" value={data.signins.never} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Nové hodiny (7 / 30 dní)" value={`${a.lesson_plans_7d ?? 0} / ${a.lesson_plans_30d ?? 0}`} />
            <Stat label="Nové prezentace (7 / 30 dní)" value={`${a.presentations_7d ?? 0} / ${a.presentations_30d ?? 0}`} />
            <Stat label="Zadané úkoly (7 / 30 dní)" value={`${a.assignments_7d ?? 0} / ${a.assignments_30d ?? 0}`} />
            <Stat label="Odevzdání žáků (7 / 30 dní)" value={`${a.submissions_7d ?? 0} / ${a.submissions_30d ?? 0}`} />
            <Stat label="Živé hry (7 / 30 dní)" value={`${a.games_7d ?? 0} / ${a.games_30d ?? 0}`} />
            <Stat label="Dokončené lekce (30 dní)" value={a.lessons_completed_30d ?? 0} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" /> Rezervace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Čeká na schválení" value={data.reservations.pending} />
            <Stat label="Nejbližších 7 dní" value={data.reservations.upcoming_7d} />
            <Stat label="Aktivních zdrojů" value={data.reservations.resources_total} />
          </div>
          {data.reservations.top_resources_week.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Nejvytíženější zdroje (±7 dní)</p>
              <ul className="space-y-1 text-sm">
                {data.reservations.top_resources_week.map((r) => (
                  <li key={r.name} className="flex items-center justify-between border-b border-border/60 pb-1">
                    <span className="flex items-center gap-2">
                      <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                      {r.name}
                      <Badge variant="outline" className="text-xs">
                        {r.type === "room" ? "místnost" : "inventář"}
                      </Badge>
                    </span>
                    <span className="text-muted-foreground">
                      {r.reservations}× · {r.hours} h
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolOverviewTab;
