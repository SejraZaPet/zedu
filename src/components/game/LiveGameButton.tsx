import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Gamepad2, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_GAME_SETTINGS, type GameQuestion, type GameSettings, generateGameCode } from "@/lib/game-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

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
      <Button
        onClick={() => setOpen(true)}
        variant="outline-gold"
        className="gap-2"
      >
        <Gamepad2 className="w-4 h-4" />
        Spustit živou hru
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Nastavení hry
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div>
              <Label className="text-sm">Čas na otázku: {settings.timePerQuestion}s</Label>
              <Slider
                min={5}
                max={60}
                step={5}
                value={[settings.timePerQuestion]}
                onValueChange={([v]) => setSettings((s) => ({ ...s, timePerQuestion: v }))}
                className="mt-2"
              />
            </div>

            <div className="space-y-3">
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
            <Button
              onClick={handleCreate}
              disabled={creating || questions.length === 0}
              variant="hero"
              className="gap-2"
            >
              <Gamepad2 className="w-4 h-4" />
              {creating ? "Vytváření..." : "Spustit hru"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
