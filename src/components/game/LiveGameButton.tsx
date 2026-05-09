import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Gamepad2, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_GAME_SETTINGS, type GameQuestion, type GameSettings, generateGameCode } from "@/lib/game-types";
import { GAME_MODES, getModeDef, type GameMode } from "@/lib/game-modes";
import { VISUAL_THEMES, type VisualTheme } from "@/lib/game-themes";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  questions: GameQuestion[];
}

export const LiveGameButton = ({ title, questions }: Props) => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_GAME_SETTINGS });
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const currentMode = getModeDef(settings.gameMode);

  const setMode = (id: GameMode) => {
    const def = getModeDef(id);
    setSettings((s) => ({ ...s, gameMode: id, theme: def.themes[0].id }));
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({ title: "Musíte být přihlášeni", variant: "destructive" });
        setCreating(false);
        return;
      }

      const gameCode = generateGameCode();
      const { data, error } = await supabase.from("game_sessions").insert({
        teacher_id: session.user.id,
        title,
        game_code: gameCode,
        activity_data: questions as any,
        settings: settings as any,
        status: "lobby",
        current_question_index: -1,
      }).select().single();

      if (error) {
        toast({ title: "Nepodařilo se vytvořit hru", description: error.message, variant: "destructive" });
        setCreating(false);
        return;
      }

      navigate(`/hra/ucitel/${data.id}`);
    } catch {
      toast({ title: "Chyba při vytváření hry", variant: "destructive" });
      setCreating(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline-gold" className="gap-2">
        <Gamepad2 className="w-4 h-4" />
        Spustit živou hru
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Nastavení hry
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Mode picker */}
            <div>
              <Label className="text-sm mb-2 block">Herní mód</Label>
              <div className="grid grid-cols-2 gap-2">
                {GAME_MODES.map((m) => {
                  const active = settings.gameMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={cn(
                        "text-left rounded-lg border p-3 transition",
                        active
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                          : "border-border hover:border-primary/50 hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{m.emoji}</span>
                        <span className="font-semibold text-sm">{m.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-snug">{m.description}</p>
                      <p className="text-[10px] text-primary font-medium mt-1">{m.scoringHint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme picker */}
            {currentMode.themes.length > 1 && (
              <div>
                <Label className="text-sm mb-2 block">Téma</Label>
                <div className="flex flex-wrap gap-2">
                  {currentMode.themes.map((th) => {
                    const active = settings.theme === th.id;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => setSettings((s) => ({ ...s, theme: th.id }))}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition flex items-center gap-1.5",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-muted/50",
                        )}
                      >
                        <span>{th.emoji}</span> {th.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm">Čas na otázku: {settings.timePerQuestion}s</Label>
              <Slider
                min={5} max={60} step={5}
                value={[settings.timePerQuestion]}
                onValueChange={([v]) => setSettings((s) => ({ ...s, timePerQuestion: v }))}
                className="mt-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={settings.shuffleQuestions}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, shuffleQuestions: !!v }))}
                />
                <Label className="text-sm">Zamíchat pořadí otázek</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={settings.shuffleAnswers}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, shuffleAnswers: !!v }))}
                />
                <Label className="text-sm">Zamíchat odpovědi</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={settings.showLeaderboardAfterEach}
                  onCheckedChange={(v) => setSettings((s) => ({ ...s, showLeaderboardAfterEach: !!v }))}
                />
                <Label className="text-sm">Zobrazit pořadí po každé otázce</Label>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {questions.length} {questions.length === 1 ? "otázka" : questions.length < 5 ? "otázky" : "otázek"} připraveno
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button>
            <Button onClick={handleCreate} disabled={creating || questions.length === 0} variant="hero" className="gap-2">
              <Gamepad2 className="w-4 h-4" />
              {creating ? "Vytváření..." : "Spustit hru"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
