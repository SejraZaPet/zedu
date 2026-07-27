import { memo } from "react";
import ProfileAvatarBubble from "@/components/profile/ProfileAvatarBubble";
import { cn } from "@/lib/utils";

export type GameAvatarReaction = "correct" | "wrong" | null;

interface Props {
  userId: string | null | undefined;
  size?: number;
  /** Full body or head crop. Defaults to full. */
  crop?: "full" | "head";
  /** Enable subtle continuous idle bounce with an optional phase offset in seconds. */
  idleBounce?: boolean;
  idleDelaySec?: number;
  /** Play a one-shot reaction animation (correct/wrong). Key it from parent to re-trigger. */
  reaction?: GameAvatarReaction;
  className?: string;
}

/**
 * Small presentational wrapper around ProfileAvatarBubble specialised for live games:
 * - never editable (no pencil badge, no streak badge, no link)
 * - can play idle-bounce / correct-jump / shake animations
 * - falls back gracefully when userId is null (guest players).
 */
function GameAvatarFigureImpl({
  userId,
  size = 72,
  crop = "full",
  idleBounce = false,
  idleDelaySec = 0,
  reaction = null,
  className,
}: Props) {
  const reactionClass =
    reaction === "correct"
      ? "animate-game-correct-jump"
      : reaction === "wrong"
      ? "animate-game-shake"
      : idleBounce
      ? "animate-game-idle-bounce"
      : "";

  return (
    <div
      className={cn("inline-block will-change-transform", reactionClass, className)}
      style={idleBounce && !reaction ? { animationDelay: `${idleDelaySec}s` } : undefined}
    >
      <ProfileAvatarBubble
        userId={userId ?? null}
        size={size}
        editable={false}
        crop={crop}
        showEditButton={false}
        showStreakBadge={false}
      />
    </div>
  );
}

export default memo(GameAvatarFigureImpl);
