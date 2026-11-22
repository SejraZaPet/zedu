import type { CSSProperties, ReactNode } from "react";
import { blockAnimation } from "@/lib/slide-block-animations";

interface Props {
  block: any;
  index: number;
  play: boolean;
  playbackKey?: string | number;
  revealed: boolean;
  className?: string;
  children: ReactNode;
}

/** Vstupní animace je oddělená od obsahu, výběru i vrstvy bloku. */
export default function SlideBlockAnimationView({ block, index, play, playbackKey = 0, revealed, className = "", children }: Props) {
  const animation = blockAnimation(block, index);
  if (!play || animation.preset === "none") return <div className={className}>{children}</div>;
  const style = {
    "--slide-block-animation-duration": `${animation.speed}s`,
    "--slide-block-animation-delay": `${animation.delay}s`,
  } as CSSProperties;
  return <div
    key={`${block.id}-${playbackKey}`}
    className={`slide-block-anim slide-block-anim-${animation.preset} ${className}`}
    data-direction={animation.direction}
    style={{ ...style, ...(!revealed ? { visibility: "hidden", pointerEvents: "none" } : {}) }}
    aria-hidden={!revealed || undefined}
  >{children}</div>;
}
