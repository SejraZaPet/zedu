import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ResetPeriod = "never" | "monthly" | "halfyear";

interface Props {
  classId: string;
}

export const LeaderboardSettingsCard = ({ classId }: Props) => {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [anonymous, setAnonymous] = useState(false);
  const [period, setPeriod] = useState<ResetPeriod>("never");
  const [resetAt, setResetAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("classes")
        .select("leaderboard_enabled, leaderboard_anonymous, leaderboard_reset_period, leaderboard_reset_at")
        .eq("id", classId)
        .maybeSingle();
      if (data) {
        setEnabled(data.leaderboard_enabled ?? true);
        setAnonymous(data.leaderboard_anonymous ?? false);
        setPeriod((data.leaderboard_reset_period as ResetPeriod) ?? "never");
        setResetAt(data.leaderboard_reset_at);
      }
    })();
  }, [classId]);

  const save = async (patch: Partial<{ leaderboard_enabled: boolean; leaderboard_anonymous: boolean; leaderboard_reset_period: ResetPeriod }>) => {
    setSaving(true);
    const { error } = await supabase.from("classes").update(patch).eq("id", classId);
    setSaving(false);
    if (error) toast({ title: "Nepodařilo se uložit nastavení", description: error.message, variant: "destructive" });
  };

  const handleReset = async () => {
    if (!confirm("Opravdu vynulovat XP žebříček v této třídě? Aktuální XP zůstanou v profilech, ale žebříček začne počítat od teď.")) return;
    setResetting(true);
    const { error } = await supabase.rpc("reset_class_leaderboard" as any, { _class_id: classId });
    setResetting(false);
    if (error) {
      toast({ title: "Reset selhal", description: error.message, variant: "destructive" });
      return;
    }
    setResetAt(new Date().toISOString());
    toast({ title: "Žebříček vynulován" });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" /> Žebříček
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="lb-enabled" className="text-sm">Zobrazit žákům</Label>
          <Switch
            id="lb-enabled"
            checked={enabled}
            onCheckedChange={(v) => { setEnabled(v); save({ leaderboard_enabled: v }); }}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="lb-anon" className="text-sm">Anonymizovat jména</Label>
          <Switch
            id="lb-anon"
            checked={anonymous}
            onCheckedChange={(v) => { setAnonymous(v); save({ leaderboard_anonymous: v }); }}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Reset</Label>
          <Select
            value={period}
            onValueChange={(v: ResetPeriod) => { setPeriod(v); save({ leaderboard_reset_period: v }); }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="never">Nikdy</SelectItem>
              <SelectItem value="monthly">Měsíčně</SelectItem>
              <SelectItem value="halfyear">Pololetně</SelectItem>
            </SelectContent>
          </Select>
          {resetAt && (
            <p className="text-xs text-muted-foreground">
              Naposledy vynulováno {new Date(resetAt).toLocaleDateString("cs-CZ")}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleReset} disabled={resetting || saving}>
          <RotateCcw className="w-4 h-4" />
          {resetting ? "Nuluji..." : "Vynulovat žebříček nyní"}
        </Button>
      </CardContent>
    </Card>
  );
};
