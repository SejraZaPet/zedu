import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import ProfileAvatarBubble from "@/components/profile/ProfileAvatarBubble";
import { useToast } from "@/hooks/use-toast";
import { tierName, weekEnd, LEAGUE_RULES } from "@/lib/league-rules";
import { Clock, Lock, Users } from "lucide-react";

interface LeagueRow { status: string; rank: number | null; display_name: string | null; avatar_user_id: string | null; xp: number | null; is_me: boolean | null; tier: number | null; group_size: number | null; week_start: string; }
interface ClassRow { rank: number; class_name: string; avg_xp: number; active_members: number; is_mine: boolean; }

const countdown = (end: Date) => {
  const ms = Math.max(0, end.getTime() - Date.now());
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d} d ${h} h` : `${h} h ${Math.floor((ms % 3600000) / 60000)} min`;
};

export const LeagueTab = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [, refreshCountdown] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => refreshCountdown((n) => n + 1), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: cls }] = await Promise.all([
      supabase.rpc("school_league_week" as any),
      supabase.rpc("class_league_week" as any),
    ]);
    setRows((data as LeagueRow[]) ?? []);
    setClasses((cls as ClassRow[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const status = rows[0]?.status ?? "disabled";
  const me = rows.find((r) => r.is_me);

  const toggle = async (join: boolean) => {
    const { error } = await supabase.rpc("set_league_opt_out" as any, { _opt_out: !join });
    if (error) { toast({ title: "Nepodařilo se změnit", description: error.message, variant: "destructive" }); return; }
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground py-6 text-center">Načítám…</p>;

  if (status === "disabled" || status === "demo") {
    return (
      <Card><CardContent className="py-10 text-center space-y-2">
        <Lock className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="font-medium">{status === "demo" ? "V ukázkovém režimu se liga nehraje." : "Tvoje škola zatím Bezli ligu nezapnula."}</p>
        <p className="text-sm text-muted-foreground">Liga je týdenní soutěž žáků tvého ročníku. Zapíná ji vedení školy.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch id="league-join" checked={status !== "opted_out"} onCheckedChange={toggle} />
            <Label htmlFor="league-join">Zapojit se do ligy</Label>
          </div>
          {rows[0]?.week_start && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="w-4 h-4" /> Konec týdne za {countdown(weekEnd(rows[0].week_start))}
            </span>
          )}
        </CardContent>
      </Card>

      {status === "opted_out" ? (
        <p className="text-sm text-muted-foreground text-center py-4">Z ligy jsi odhlášený/á. Tvoje body nikdo neuvidí.</p>
      ) : status === "no_grade" ? (
        <p className="text-sm text-muted-foreground text-center py-4">Zatím nejsi ve třídě s ročníkem, proto tě nemůžeme zařadit do ligy.</p>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Liga {tierName(me?.tier ?? 0)}</span>
              {me && <Badge variant="secondary">Tvé pořadí: {me.rank}. z {me.group_size}</Badge>}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Nejlepších {LEAGUE_RULES.promoteTop} postoupí, posledních {LEAGUE_RULES.demoteBottom} sestoupí. Denně můžeš získat nejvýš {LEAGUE_RULES.dailyCap} XP.
            </p>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1.5">
              {rows.map((r) => (
                <li key={`${r.rank}-${r.avatar_user_id}`} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${r.is_me ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}>
                  <span className="w-7 text-right font-bold">{r.rank}.</span>
                  <ProfileAvatarBubble userId={r.avatar_user_id} size={32} editable={false} crop="head" />
                  <span className="flex-1 truncate font-medium">{r.display_name}{r.is_me && <span className="ml-1 text-xs text-primary">(ty)</span>}</span>
                  <span className="font-mono font-bold text-primary">{r.xp} XP</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {classes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Soutěž tříd</CardTitle>
            <p className="text-xs text-muted-foreground">Průměr XP aktivních žáků za tento týden.</p>
          </CardHeader>
          <CardContent>
            <ol className="space-y-1.5">
              {classes.map((c) => (
                <li key={c.rank} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${c.is_mine ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}>
                  <span className="w-7 text-right font-bold">{c.rank}.</span>
                  <span className="flex-1 truncate">{c.class_name}</span>
                  <span className="font-mono font-bold text-primary">{c.avg_xp} XP</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
