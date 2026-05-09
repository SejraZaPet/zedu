import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AvatarSvg } from "@/components/student/AvatarSvg";
import { Trophy, Lock, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ClassRow {
  id: string;
  name: string;
  leaderboard_enabled: boolean;
  leaderboard_anonymous: boolean;
  leaderboard_reset_period: string;
  leaderboard_reset_at: string | null;
}

interface Row {
  user_id: string;
  display: string;
  isMe: boolean;
  level: number;
  xp: number;
  badges: number;
  avatarSlug?: string;
}

const StudentLeaderboard = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // Load classes the student belongs to (with leaderboard settings)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: memberships } = await supabase
        .from("class_members")
        .select("class_id, classes(id, name, leaderboard_enabled, leaderboard_anonymous, leaderboard_reset_period, leaderboard_reset_at)")
        .eq("user_id", user.id);
      const cls = (memberships ?? [])
        .map((m: any) => m.classes)
        .filter(Boolean) as ClassRow[];
      setClasses(cls);
      if (cls.length && !classId) setClassId(cls[0].id);
    })();
  }, [user]);

  const currentClass = useMemo(() => classes.find((c) => c.id === classId), [classes, classId]);

  useEffect(() => {
    if (!classId || !user) return;
    if (currentClass && !currentClass.leaderboard_enabled) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { data: members } = await supabase
        .from("class_members")
        .select("user_id")
        .eq("class_id", classId);
      const ids = (members ?? []).map((m: any) => m.user_id);
      if (ids.length === 0) { setRows([]); setLoading(false); return; }

      const [{ data: profiles }, { data: xps }, { data: avatars }, { data: badges }, { data: baselines }] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name").in("id", ids),
        supabase.from("student_xp").select("student_id, total_xp, level").in("student_id", ids),
        supabase.from("student_avatars").select("student_id, avatar_slug").in("student_id", ids),
        supabase.from("student_badges").select("student_id").in("student_id", ids),
        supabase.from("class_leaderboard_baselines").select("student_id, baseline_xp").eq("class_id", classId),
      ]);

      const baseMap = new Map<string, number>();
      (baselines ?? []).forEach((b: any) => baseMap.set(b.student_id, b.baseline_xp ?? 0));
      const xpMap = new Map<string, { total: number; level: number }>();
      (xps ?? []).forEach((x: any) => xpMap.set(x.student_id, { total: x.total_xp ?? 0, level: x.level ?? 1 }));
      const avMap = new Map<string, string>();
      (avatars ?? []).forEach((a: any) => avMap.set(a.student_id, a.avatar_slug));
      const badgeCount = new Map<string, number>();
      (badges ?? []).forEach((b: any) => badgeCount.set(b.student_id, (badgeCount.get(b.student_id) ?? 0) + 1));

      const anon = !!currentClass?.leaderboard_anonymous;

      const built: Row[] = ids.map((id) => {
        const prof = (profiles ?? []).find((p: any) => p.id === id);
        const xp = xpMap.get(id);
        const total = (xp?.total ?? 0) - (baseMap.get(id) ?? 0);
        const isMe = id === user.id;
        const name = prof ? `${prof.first_name ?? ""} ${prof.last_name ?? ""}`.trim() : "—";
        return {
          user_id: id,
          display: anon && !isMe ? "Anonymní žák" : (name || "—"),
          isMe,
          level: xp?.level ?? 1,
          xp: Math.max(0, total),
          badges: badgeCount.get(id) ?? 0,
          avatarSlug: avMap.get(id),
        };
      }).sort((a, b) => b.xp - a.xp);

      setRows(built);
      setLoading(false);
    })();
  }, [classId, user, currentClass]);

  const myRank = rows.findIndex((r) => r.isMe);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-heading font-bold">Žebříček</h1>
            <p className="text-sm text-muted-foreground">Pořadí podle nasbíraných XP ve tvojí třídě.</p>
          </div>
        </div>

        {classes.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            Zatím nejsi v žádné třídě. Připoj se kódem od učitele.
          </CardContent></Card>
        ) : (
          <>
            {classes.length > 1 && (
              <div className="mb-4 max-w-xs">
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {currentClass && !currentClass.leaderboard_enabled ? (
              <Card>
                <CardContent className="py-12 text-center space-y-2">
                  <Lock className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="font-medium">Učitel zatím žebříček v této třídě nezveřejnil.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{currentClass?.name}</span>
                    {myRank >= 0 && (
                      <Badge variant="secondary">Tvé pořadí: {myRank + 1}.</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Načítám…</p>
                  ) : rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Zatím žádná data.</p>
                  ) : (
                    <ol className="space-y-1.5">
                      {rows.map((r, i) => {
                        const medal = i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-muted-foreground";
                        return (
                          <li
                            key={r.user_id}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${r.isMe ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}
                          >
                            <span className={`w-7 text-right font-bold ${medal}`}>{i + 1}.</span>
                            <AvatarSvg slug={r.avatarSlug} size={36} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {r.display}{r.isMe && <span className="ml-1 text-xs text-primary">(ty)</span>}
                              </p>
                              <p className="text-xs text-muted-foreground">Level {r.level}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-bold text-primary">{r.xp} XP</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                <Award className="w-3 h-3" /> {r.badges}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground text-center mt-4">
              <Link to="/student" className="hover:underline">← Zpět na nástěnku</Link>
            </p>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default StudentLeaderboard;
