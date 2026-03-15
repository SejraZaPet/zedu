import { GameSession, GamePlayer } from "@/lib/game-types";
import { Button } from "@/components/ui/button";
import { Users, Play, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/t";

interface Props {
  session: GameSession;
  players: GamePlayer[];
  onStart?: () => void;
  isTeacher: boolean;
}

export const GameLobby = ({ session, players, onStart, isTeacher }: Props) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copyCode = () => {
    navigator.clipboard.writeText(session.game_code);
    setCopied(true);
    toast({ title: t("student.toasts.joined.title") });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-8 max-w-lg w-full">
        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
            {session.title || t("projector.headline")}
          </h1>
          <p className="text-muted-foreground">
            {isTeacher ? t("projector.body") : t("student.states.waitingForTeacher")}
          </p>
        </div>

        {/* Game Code */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("projector.headline")}</p>
          <button
            onClick={copyCode}
            className="inline-flex items-center gap-3 bg-card border-2 border-primary/30 rounded-2xl px-8 py-5 hover:border-primary/60 transition-colors group"
          >
            <span className="text-5xl md:text-6xl font-mono font-bold tracking-[0.3em] text-primary">
              {session.game_code}
            </span>
            {copied ? (
              <Check className="w-6 h-6 text-green-500" />
            ) : (
              <Copy className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
          </button>
        </div>

        {/* Players */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Users className="w-5 h-5" />
            <span className="font-medium">{t("projector.playerCount", players.length)}</span>
          </div>

          <div className="flex flex-wrap justify-center gap-2 max-h-40 overflow-y-auto">
            {players.map((player, i) => (
              <div
                key={player.id}
                className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-medium text-foreground animate-scale-in"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {player.nickname}
              </div>
            ))}
            {players.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Zatím se nikdo nepřipojil...</p>
            )}
          </div>
        </div>

        {/* Start button (teacher only) */}
        {isTeacher && onStart && (
          <Button
            onClick={onStart}
            disabled={players.length === 0}
            size="lg"
            variant="hero"
            className="text-lg px-10 py-6 gap-3"
          >
            <Play className="w-6 h-6" />
            Začít hru
          </Button>
        )}

        {!isTeacher && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">Čekáme na učitele...</span>
          </div>
        )}
      </div>
    </div>
  );
};
