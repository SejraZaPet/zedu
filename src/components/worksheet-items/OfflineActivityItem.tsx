/**
 * OfflineActivityItem — Read-only renderer pro typ "offline_activity".
 *
 * Offline aktivity (diskuse, skupinová práce, praktická cvičení, pozorování,
 * reflexe) nemají digitální vstupní pole — žák je vykonává mimo zařízení.
 * V online přehrávači se zobrazí jako informativní karta s ikonami pro režim,
 * skupinu a odhad délky. Pole `value` se nepoužívá, `onChange` se nezavolá.
 */

import { Users, Clock, MessageCircle, FlaskConical, Eye, Lightbulb, type LucideIcon } from "lucide-react";
import { OFFLINE_MODE_LABELS, GROUP_SIZE_LABELS } from "@/lib/worksheet-defaults";
import type { WorksheetItemProps } from "./types";
import type { OfflineMode } from "@/lib/worksheet-spec";

const MODE_ICONS: Record<OfflineMode, LucideIcon> = {
  discussion: MessageCircle,
  group_work: Users,
  practical: FlaskConical,
  observation: Eye,
  reflection: Lightbulb,
};

export default function OfflineActivityItem({ item }: WorksheetItemProps) {
  const mode = item.offlineMode ?? "discussion";
  const groupSize = item.groupSize ?? "class";
  const duration = item.durationMin;
  const Icon = MODE_ICONS[mode];

  return (
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Icon className="h-4 w-4" />
        <span>Offline aktivita: {OFFLINE_MODE_LABELS[mode]}</span>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {GROUP_SIZE_LABELS[groupSize]}
        </span>
        {duration && duration > 0 && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            ~{duration} min
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground italic">
        Tato aktivita probíhá mimo zařízení. Postupujte podle pokynů učitele a po skončení se vraťte k dalším úlohám.
      </p>
    </div>
  );
}
