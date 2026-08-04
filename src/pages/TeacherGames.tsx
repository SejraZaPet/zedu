import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gamepad2, Trash2, Plus, Play, Pencil, Library } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getModeDef, getThemeDef } from "@/lib/game-modes";
import {
  fetchGameTemplates, launchTemplateSession, purposeLabel,
  GAME_PURPOSES, type GameTemplate,
} from "@/lib/game-templates";
import { GameTemplateEditorDialog } from "@/components/game/GameTemplateEditorDialog";

interface GameSessionRow {
  id: string;
  title: string;
  game_code: string;
  status: string;
  activity_data: any;
  settings: any;
  created_at: string;
}

const ALL = "__all__";

const TeacherGames = () => {
  const [sessions, setSessions] = useState<GameSessionRow[]>([]);
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [purposeFilter, setPurposeFilter] = useState(ALL);
  const [subjectFilter, setSubjectFilter] = useState(ALL);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<GameTemplate | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const loadTemplates = async () => {
    try {
      setTemplates(await fetchGameTemplates());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const [{ data }] = await Promise.all([
        supabase
          .from("game_sessions")
          .select("*")
          .eq("teacher_id", session.user.id)
          .order("created_at", { ascending: false }),
        loadTemplates(),
      ]);

      if (data) setSessions(data as any);
      setLoading(false);
    };
    load();
  }, []);

  const subjectOptions = useMemo(
    () => Array.from(new Set(templates.map((t) => t.subject).filter(Boolean))) as string[],
    [templates],
  );

  const filteredTemplates = useMemo(
    () => templates.filter((t) =>
      (purposeFilter === ALL || t.purpose === purposeFilter) &&
      (subjectFilter === ALL || t.subject === subjectFilter)),
    [templates, purposeFilter, subjectFilter],
  );

  const deleteSession = async (id: string) => {
    await supabase.from("game_sessions").delete().eq("id", id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Hra smazána" });
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("teacher_game_templates" as any).delete().eq("id", id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast({ title: "Hra odstraněna z knihovny" });
  };

  const launch = async (tpl: GameTemplate) => {
    try {
      const sessionId = await launchTemplateSession(tpl);
      navigate(`/live/ucitel/${sessionId}`);
    } catch (e: any) {
      toast({
        title: "Chyba",
        description: e?.message || "Nepodařilo se spustit hru",
        variant: "destructive",
      });
    }
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
      <main className="flex-1 pb-16 px-4 md:px-8" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground flex items-center gap-3">
              <Gamepad2 className="w-7 h-7 text-primary" />
              Moje hry a aktivity
            </h1>
            <Button
              className="gap-1.5"
              onClick={() => { setEditing(null); setEditorOpen(true); }}
            >
              <Plus className="w-4 h-4" /> Nová hra
            </Button>
          </div>

          <Tabs defaultValue="library">
            <TabsList>
              <TabsTrigger value="library" className="gap-1.5">
                <Library className="w-4 h-4" /> Knihovna her
              </TabsTrigger>
              <TabsTrigger value="sessions" className="gap-1.5">
                <Gamepad2 className="w-4 h-4" /> Živé hry
              </TabsTrigger>
            </TabsList>

            <TabsContent value="library" className="space-y-4 pt-4">
              <div className="flex gap-2 flex-wrap">
                <Select value={purposeFilter} onValueChange={setPurposeFilter}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Všechny účely</SelectItem>
                    {GAME_PURPOSES.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.emoji} {p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Všechny předměty</SelectItem>
                    {subjectOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Načítání...</div>
              ) : filteredTemplates.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Library className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {templates.length === 0
                        ? "Knihovna je prázdná."
                        : "Žádná hra neodpovídá filtru."}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Vytvořte samostatnou hru nebo aktivitu tlačítkem „Nová hra".
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredTemplates.map((t) => {
                    const mode = getModeDef(t.default_game_mode);
                    return (
                      <Card key={t.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="flex items-center gap-3 py-4 flex-wrap">
                          <div className="flex-1 min-w-[180px]">
                            <h3 className="font-semibold text-foreground truncate">{t.title}</h3>
                            {t.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">{t.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                <span>{mode.emoji}</span>{mode.name}
                              </span>
                              <span className="text-xs">{purposeLabel(t.purpose)}</span>
                              {t.subject && <><span>•</span><span className="text-xs">{t.subject}</span></>}
                              <span>•</span>
                              <span className="text-xs">
                                {Array.isArray(t.activity_data) ? t.activity_data.length : 0} slidů
                              </span>
                            </div>
                          </div>
                          <Button size="sm" className="gap-1.5" onClick={() => launch(t)}>
                            <Play className="w-3.5 h-3.5" /> Spustit
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setEditing(t); setEditorOpen(true); }}
                            aria-label="Upravit"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteTemplate(t.id)}
                            aria-label="Smazat"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sessions" className="space-y-3 pt-4">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Načítání...</div>
              ) : sessions.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Gamepad2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Zatím nemáte žádné živé hry.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Hru spustíte z knihovny her nebo z aktivity v lekci.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                sessions.map((s) => (
                  <Card key={s.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{s.title || "Bez názvu"}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                          {(() => {
                            const mode = getModeDef(s.settings?.gameMode);
                            const theme = getThemeDef(s.settings?.gameMode, s.settings?.theme);
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                <span>{mode.emoji}</span>{mode.name}
                                {mode.themes.length > 1 && (
                                  <span className="opacity-70">· {theme.emoji} {theme.name}</span>
                                )}
                              </span>
                            );
                          })()}
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
                          onClick={() => navigate(`/live/ucitel/${s.id}`)}
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
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <SiteFooter />

      <GameTemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editing}
        onSaved={loadTemplates}
      />
    </div>
  );
};

export default TeacherGames;
