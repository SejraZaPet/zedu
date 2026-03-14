import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gamepad2, Clock, Users, Trophy, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GameSessionRow {
  id: string;
  title: string;
  game_code: string;
  status: string;
  activity_data: any;
  created_at: string;
}

const TeacherGames = () => {
  const [sessions, setSessions] = useState<GameSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("teacher_id", session.user.id)
        .order("created_at", { ascending: false });

      if (data) setSessions(data as any);
      setLoading(false);
    };
    load();
  }, []);

  const deleteSession = async (id: string) => {
    await supabase.from("game_sessions").delete().eq("id", id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Hra smazána" });
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "lobby": return "Lobby";
      case "playing": return "Probíhá";
      case "question_results": return "Probíhá";
      case "finished": return "Dokončeno";
      default: return status;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "lobby": return "bg-yellow-500/10 text-yellow-600";
      case "playing":
      case "question_results": return "bg-green-500/10 text-green-600";
      case "finished": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 pt-[90px] pb-16 px-4 md:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground flex items-center gap-3">
              <Gamepad2 className="w-7 h-7 text-primary" />
              Živé hry
            </h1>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Načítání...</div>
          ) : sessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Zatím nemáte žádné živé hry.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Hru spustíte z aktivity v lekci tlačítkem „Spustit živou hru".
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <Card key={s.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{s.title || "Bez názvu"}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="font-mono">{s.game_code}</span>
                        <span>•</span>
                        <span>{Array.isArray(s.activity_data) ? s.activity_data.length : 0} otázek</span>
                        <span>•</span>
                        <span>{new Date(s.created_at).toLocaleDateString("cs")}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor(s.status)}`}>
                      {statusLabel(s.status)}
                    </span>
                    {s.status !== "finished" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/hra/ucitel/${s.id}`)}
                      >
                        Otevřít
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteSession(s.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherGames;
