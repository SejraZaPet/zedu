import { useParams } from "react-router-dom";
import { useGameSession, useTeacherGameControls } from "@/hooks/useGameSession";
import { GameLobby } from "@/components/game/GameLobby";
import { GameProjector } from "@/components/game/GameProjector";
import { GameLeaderboardFinal } from "@/components/game/GameLeaderboardFinal";
import { ConnectionStatusBanner } from "@/components/game/ConnectionStatusBanner";
import { useState, useEffect, useCallback } from "react";
import { serverTsToClientMs } from "@/lib/clock-sync";

const TeacherGameScreen = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, players, responses, loading, connectionStatus, reconnect } = useGameSession(sessionId);
  const { startGame, nextQuestion, showResults, endGame } = useTeacherGameControls(sessionId);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Timer countdown
  useEffect(() => {
    if (!session || session.status !== "playing" || !session.question_started_at) {
      setCountdown(null);
      return;
    }
    const timeLimit = (session.settings?.timePerQuestion || 20) * 1000;
    const startedAtMs = serverTsToClientMs(session.question_started_at!);
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAtMs;
      const remaining = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        showResults();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [session?.status, session?.question_started_at, session?.settings?.timePerQuestion, showResults]);

  const handleNext = useCallback(() => {
    if (!session) return;
    const totalQ = session.activity_data.length;
    if (session.current_question_index >= totalQ - 1) {
      endGame();
    } else {
      nextQuestion(session.current_question_index);
    }
  }, [session, nextQuestion, endGame]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-lg">Načítání...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive text-lg">Hra nebyla nalezena.</p>
      </div>
    );
  }

  if (session.status === "lobby") {
    return <GameLobby session={session} players={players} onStart={startGame} isTeacher />;
  }

  if (session.status === "finished") {
    return <GameLeaderboardFinal session={session} players={players} responses={responses} />;
  }

  // playing or question_results
  return (
    <>
    <ConnectionStatusBanner status={connectionStatus} onReconnect={reconnect} />
    <GameProjector
      session={session}
      players={players}
      responses={responses}
      countdown={countdown}
      onShowResults={showResults}
      onNext={handleNext}
      onEnd={endGame}
    />
    </>
  );
};

export default TeacherGameScreen;
