import {
  BookOpen,
  Sparkles,
  GraduationCap,
  Rocket,
  Play,
  Layout,
  Code,
  Users,
  Gift,
  Gamepad2,
  Calendar,
  Brain,
  Trophy,
  Heart,
  UserRound,
  Backpack,
  Check,
  Mic,
  ArrowRight,
  Image as ImageIcon,
  Star,
  Zap,
  Award,
  Target,
  Lightbulb,
  MessageCircle,
  Layers,
  Presentation,
  Network,
  type LucideIcon,
} from "lucide-react";

// Allowlist: string name → Lucide component. Adding new icons here is intentional
// (avoids dynamic imports & keeps the surface area small for admins).
export const LANDING_ICONS: Record<string, LucideIcon> = {
  BookOpen,
  Sparkles,
  GraduationCap,
  Rocket,
  Play,
  Layout,
  Code,
  Users,
  Gift,
  Gamepad2,
  Calendar,
  Brain,
  Trophy,
  Heart,
  UserRound,
  Backpack,
  Check,
  Mic,
  ArrowRight,
  ImageIcon,
  Star,
  Zap,
  Award,
  Target,
  Lightbulb,
  MessageCircle,
};

export const LANDING_ICON_NAMES = Object.keys(LANDING_ICONS);

export function getLandingIcon(name: string | undefined | null, fallback: LucideIcon = Sparkles): LucideIcon {
  if (!name) return fallback;
  return LANDING_ICONS[name] ?? fallback;
}
