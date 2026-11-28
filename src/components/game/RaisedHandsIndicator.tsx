import { Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { sortRaisedHands } from "@/lib/raised-hands";
import type { GamePlayer } from "@/lib/game-types";

/**
 * Pozice: uprostřed nahoře těsně pod 55px lištou učitele (a pod případným demo pruhem),
 * aby nikdy nepřekrývala plovoucí „Přidat slide“ ani spodní panel „Spustit aktivitu“.
 */
export const RAISED_HANDS_POSITION_STYLE = { top: "calc(var(--demo-banner-h, 0px) + 63px)", left: "50%", transform: "translateX(-50%)" } as const;

/** Always-visible teacher indicator of raised hands (lobby, slides, solo rounds). */
export default function RaisedHandsIndicator({ players, anonymousLabels }: { players: GamePlayer[]; anonymousLabels?: Record<string, string> }) {
  const raised = sortRaisedHands(players);
  return (
    <div className="fixed z-40" style={RAISED_HANDS_POSITION_STYLE} data-testid="raised-hands-indicator" aria-live="polite">
      {raised.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button className="gap-2 rounded-full shadow-lg" aria-label={`Zvednuté ruce: ${raised.length}`}>
              <Hand className="h-4 w-4" aria-hidden /> Hlásí se {raised.length}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-72">
            <p className="mb-2 text-sm font-semibold">Zvednuté ruce</p>
            <ol className="space-y-1">
              {raised.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate"><span className="mr-1 text-muted-foreground">{i + 1}.</span>{anonymousLabels?.[p.id] ?? p.nickname}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { void supabase.rpc("clear_player_hand" as any, { _player_id: p.id }); }}>
                    Odbavit
                  </Button>
                </li>
              ))}
            </ol>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
