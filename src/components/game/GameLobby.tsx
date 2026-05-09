import { GameSession, GamePlayer } from "@/lib/game-types";
import { Button } from "@/components/ui/button";
import { Users, Play, Copy, Check } from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { t } from "@/lib/t";
import { QRCodeSVG } from "qrcode.react";
import { TeamSetup } from "@/components/game/TeamSetup";

interface Props {
  session: GameSession;
  players: GamePlayer[];
  onStart?: () => void;
  isTeacher: boolean;
}

export const GameLobby = ({ session, players, onStart, isTeacher }: Props) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const joinUrl = useMemo(() => {
    const base = window.location.origin;
    return `${base}/game/join?code=${session.game_code}`;
  }, [session.game_code]);

  const copyCode = () => {
    navigator.clipboard.writeText(session.game_code);
    setCopied(true);
    toast({ title: t("student.toasts.joined.title") });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col items-center justify-center p-4">
      {isTeacher && (
        <div className="absolute top-4 left-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/ucitel/ucebnice")}>
            ← Zpět do učebnice
          </Button>
        </div>
      )}
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

        {/* QR Code + Game Code */}
        <div className="space-y-4">
          {/* QR */}
          <div className="flex justify-center">
            <div
              className="bg-white p-4 rounded-2xl shadow-sm border border-border inline-block"
              role="img"
              aria-label={t("a11y.lobby.qrAlt", session.game_code)}
            >
              <QRCodeSVG
                value={joinUrl}
                size={180}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
                includeMargin={false}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("a11y.lobby.qrHint")}
          </p>

          {/* Text code fallback */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider" id="game-code-label">
              {t("projector.headline")}
            </p>
            <button
              onClick={copyCode}
              aria-label={`${t("a11y.lobby.gameCodeLabel")}: ${session.game_code}`}
              aria-describedby="game-code-label"
              className="inline-flex items-center gap-3 bg-card border-2 border-primary/30 rounded-2xl px-8 py-5 hover:border-primary/60 transition-colors group"
            >
              <span className="text-5xl md:text-6xl font-mono font-bold tracking-[0.3em] text-primary" aria-hidden="true">
                {session.game_code}
              </span>
              {copied ? (
                <Check className="w-6 h-6 text-green-500" />
              ) : (
                <Copy className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Users className="w-5 h-5" />
            <span className="font-medium" aria-live="polite">{t("projector.playerCount", players.length)}</span>
          </div>

          <div
            className="flex flex-wrap justify-center gap-2 max-h-40 overflow-y-auto"
            role="list"
            aria-label={t("a11y.lobby.playerListLabel")}
            aria-live="polite"
            aria-relevant="additions"
          >
            {players.map((player, i) => (
              <div
                key={player.id}
                role="listitem"
                className="bg-card border border-border rounded-xl px-4 py-2 text-sm font-medium text-foreground animate-scale-in"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {player.nickname}
              </div>
            ))}
            {players.length === 0 && (
              <p className="text-sm text-muted-foreground italic">{t("projector.waitingForPlayers")}</p>
            )}
          </div>
        </div>

        {/* Team setup (teacher only when team mode active) */}
        {isTeacher && (session.settings?.teamModeKind ?? "none") !== "none" && players.length > 0 && (
          <TeamSetup session={session} players={players} />
        )}

        {/* Start button (teacher only) */}
        {isTeacher && onStart && (
          <Button
            onClick={onStart}
            size="lg"
            variant="hero"
            className="text-lg px-10 py-6 gap-3"
          >
            <Play className="w-6 h-6" />
            {t("teacher.buttons.startInClass")}
          </Button>
        )}

        {!isTeacher && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">{t("student.states.waitingForTeacher")}</span>
          </div>
        )}
      </div>
    </div>
  );
};
