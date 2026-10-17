import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const SchoolLeagueCard = ({ schoolId }: { schoolId: string }) => {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<"nickname" | "initial">("nickname");

  useEffect(() => {
    supabase.from("schools").select("league_enabled, league_name_mode").eq("id", schoolId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setEnabled(!!data.league_enabled);
        setMode((data.league_name_mode as "nickname" | "initial") ?? "nickname");
      });
  }, [schoolId]);

  const save = async (patch: { league_enabled?: boolean; league_name_mode?: string }) => {
    const { error } = await supabase.from("schools").update(patch).eq("id", schoolId);
    if (error) toast({ title: "Nastavení ligy se nepodařilo uložit", description: error.message, variant: "destructive" });
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" /> Bezli liga</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Týdenní soutěž žáků stejného ročníku ve vaší škole (skupiny po 30, ligy Bronz – Diamant). Žáci vidí jen top 10 a svou pozici a mohou se odhlásit.
        </p>
        <div className="flex items-center justify-between">
          <Label htmlFor="league-on">Zapnout ligu pro školu</Label>
          <Switch id="league-on" checked={enabled} onCheckedChange={(v) => { setEnabled(v); save({ league_enabled: v }); }} />
        </div>
        <div className="space-y-1.5">
          <Label>Zobrazení jména v žebříčku</Label>
          <Select value={mode} onValueChange={(v: "nickname" | "initial") => { setMode(v); save({ league_name_mode: v }); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nickname">Přezdívka (uživatelské jméno)</SelectItem>
              <SelectItem value="initial">Jméno a iniciála příjmení</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
