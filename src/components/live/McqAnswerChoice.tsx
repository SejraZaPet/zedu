import type { ComponentType } from "react";
import {
  Circle,
  Diamond,
  Hexagon,
  Octagon,
  Pentagon,
  Square,
  Star,
  Triangle,
  type LucideProps,
} from "lucide-react";

const OPTION_STYLES = [
  "bg-answer-red border-answer-red-strong",
  "bg-answer-blue border-answer-blue-strong",
  "bg-answer-yellow border-answer-yellow-strong",
  "bg-answer-green border-answer-green-strong",
  "bg-answer-purple border-answer-purple-strong",
  "bg-answer-orange border-answer-orange-strong",
  "bg-answer-teal border-answer-teal-strong",
  "bg-answer-pink border-answer-pink-strong",
];

const OPTION_ICONS: ComponentType<LucideProps>[] = [
  Triangle,
  Diamond,
  Circle,
  Square,
  Star,
  Hexagon,
  Pentagon,
  Octagon,
];

const OPTION_NAMES = [
  "červený trojúhelník",
  "modrý kosočtverec",
  "žlutý kruh",
  "zelený čtverec",
  "fialová hvězda",
  "oranžový šestiúhelník",
  "tyrkysový pětiúhelník",
  "růžový osmiúhelník",
];

export const getMcqOptionStyle = (index: number) => OPTION_STYLES[index % OPTION_STYLES.length];

export const getMcqOptionName = (index: number) => {
  const cycle = Math.floor(index / OPTION_NAMES.length);
  const base = OPTION_NAMES[index % OPTION_NAMES.length];
  return cycle > 0 ? `${base}, sada ${cycle + 1}` : base;
};

export const McqOptionIcon = ({ index, className = "h-8 w-8" }: { index: number; className?: string }) => {
  const Icon = OPTION_ICONS[index % OPTION_ICONS.length];
  return <Icon className={className} fill="currentColor" strokeWidth={2.5} aria-hidden />;
};
