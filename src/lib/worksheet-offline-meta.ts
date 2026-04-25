/**
 * Mapování offline mode → Lucide ikony a default body.
 * Drženo zvlášť, aby se to dalo importovat i v editoru i v rendererech.
 */
import {
  MessageSquare,
  Users,
  Wrench,
  Eye,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { OfflineMode } from "@/lib/worksheet-spec";

export const OFFLINE_MODE_META: Record<
  OfflineMode,
  { icon: LucideIcon; label: string; defaultDuration: number; defaultGroup: "individual" | "pair" | "small_group" | "class"; defaultPrompt: string }
> = {
  discussion: {
    icon: MessageSquare,
    label: "Diskuse",
    defaultDuration: 10,
    defaultGroup: "class",
    defaultPrompt: "Diskutujte ve třídě o tématu a zapište si hlavní závěry.",
  },
  group_work: {
    icon: Users,
    label: "Skupinová práce",
    defaultDuration: 15,
    defaultGroup: "small_group",
    defaultPrompt: "Ve skupinách vyřešte zadaný úkol a připravte si krátkou prezentaci.",
  },
  practical: {
    icon: Wrench,
    label: "Praktická aktivita",
    defaultDuration: 20,
    defaultGroup: "pair",
    defaultPrompt: "Proveďte praktickou činnost podle pokynů a zaznamenejte výsledky.",
  },
  observation: {
    icon: Eye,
    label: "Pozorování",
    defaultDuration: 10,
    defaultGroup: "individual",
    defaultPrompt: "Pozorujte zadaný jev a popište, co jste viděli.",
  },
  reflection: {
    icon: Sparkles,
    label: "Reflexe",
    defaultDuration: 5,
    defaultGroup: "individual",
    defaultPrompt: "Zamyslete se nad tím, co jste se naučili. Co bylo nejvíc překvapivé?",
  },
};
