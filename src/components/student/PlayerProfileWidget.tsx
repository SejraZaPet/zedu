import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { AvatarSvg } from "@/components/student/AvatarSvg";
import { useStudentAvatar } from "@/hooks/useStudentAvatars";
import { BADGES, getBadge, xpForLevel } from "@/lib/badges";
import { Flame, Trophy, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  firstName?: string;
  lastName?: string;
}

interface EarnedBadge {
  badge_slug: string;
  earned_at: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });

const PlayerProfileWidget = ({ userId, firstName, lastName }: Props) => {
  const avatarSlug = useStudentAvatar(userId);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [streak, setStreak] = useState(0);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [{ data: xpRow }, { data: badgeRows }] = await Promise.all([
        supabase
          .from("student_xp")
          .select("total_xp, level, streak_days")
          .eq("student_id", userId)
          .maybeSingle(),
        supabase
          .from("student_badges")
          .select("badge_slug, earned_at")
          .eq("student_id", userId)
          .order("earned_at", { ascending: false }),
      ]);
      if (xpRow) {
        setXp(xpRow.total_xp ?? 0);
        setLevel(xpRow.level ?? 1);
        setStreak(xpRow.streak_days ?? 0);
      }
      setBadges((badgeRows ?? []) as EarnedBadge[]);
    })();
  }, [userId]);

  const { currentLevelXp, nextLevelXp, pct } = useMemo(() => {
    const cur = xpForLevel(level);
    const next = xpForLevel(level + 1);
    const span = Math.max(1, next - cur);
    const into = Math.max(0, xp - cur);
    return {
      currentLevelXp: cur,
      nextLevelXp: next,
      pct: Math.min(100, Math.round((into / span) * 100)),
    };
  }, [xp, level]);

  const earnedSet = useMemo(() => new Set(badges.map((b) => b.badge_slug)), [badges]);
  const earnedDateBySlug = useMemo(() => {
    const m: Record<string, string> = {};
    for (const b of badges) m[b.badge_slug] = b.earned_at;
    return m;
  }, [badges]);

  const recentBadges = badges.slice(0, 4);
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Hráč";

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" /> Můj profil hráče
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <AvatarSvg slug={avatarSlug} size={88} />
          <div className="flex-1 min-w-0">
            <div className="font-heading text-xl font-semibold truncate">{fullName}</div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <Trophy className="w-3 h-3" /> Level {level}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                {streak} {streak === 1 ? "den" : streak >= 2 && streak <= 4 ? "dny" : "dní"} v řadě
              </span>
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>{xp - currentLevelXp} / {nextLevelXp - currentLevelXp} XP do Levelu {level + 1}</span>
                <span>{xp} XP</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Poslední odznaky</h3>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">Všechny odznaky</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Všechny odznaky</DialogTitle>
                  <DialogDescription>
                    Získáno {badges.length} z {BADGES.length}.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                  {BADGES.map((b) => {
                    const earned = earnedSet.has(b.slug);
                    return (
                      <div
                        key={b.slug}
                        className={cn(
                          "rounded-lg border p-3 flex flex-col items-center text-center gap-1.5",
                          earned
                            ? "border-primary/40 bg-gradient-to-br from-primary/10 to-transparent"
                            : "border-border bg-muted/30"
                        )}
                      >
                        <div
                          className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center text-3xl relative",
                            earned ? "bg-primary/15" : "bg-muted"
                          )}
                          style={!earned ? { filter: "grayscale(1) opacity(0.55)" } : undefined}
                        >
                          {b.emoji}
                          {!earned && (
                            <Lock className="absolute bottom-0 right-0 w-4 h-4 text-muted-foreground bg-background rounded-full p-0.5" />
                          )}
                        </div>
                        <div className={cn("font-semibold text-sm", !earned && "text-muted-foreground")}>
                          {b.name}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {earned ? b.description : b.howTo}
                        </p>
                        {earned && earnedDateBySlug[b.slug] && (
                          <div className="text-[11px] text-primary font-medium mt-0.5">
                            {formatDate(earnedDateBySlug[b.slug])}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {recentBadges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Zatím žádné odznaky. Učením a plněním úkolů získáš první!
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {recentBadges.map((eb) => {
                const def = getBadge(eb.badge_slug);
                if (!def) return null;
                return (
                  <div
                    key={eb.badge_slug}
                    className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-2.5 flex items-center gap-2"
                    title={def.description}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-xl shrink-0">
                      {def.emoji}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{def.name}</div>
                      <div className="text-[10px] text-muted-foreground">{formatDate(eb.earned_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PlayerProfileWidget;
