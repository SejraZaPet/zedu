import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  GamePlayer,
  GameSession,
  Team,
  TEAM_COLORS,
  buildDefaultTeams,
  distributeRandomly,
} from "@/lib/game-types";
import { Shuffle, Save, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  session: GameSession;
  players: GamePlayer[];
}

const UNASSIGNED = "__unassigned__";

const PlayerChip = ({ player, color }: { player: GamePlayer; color?: string }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: player.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "px-3 py-1.5 rounded-lg text-sm font-medium cursor-grab active:cursor-grabbing border bg-card",
        isDragging && "opacity-30"
      )}
      style={color ? { borderColor: color, color } : undefined}
    >
      {player.nickname}
    </div>
  );
};

const TeamColumn = ({
  id,
  team,
  members,
  onRename,
}: {
  id: string;
  team?: Team;
  members: GamePlayer[];
  onRename?: (name: string) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl border-2 p-3 min-h-[140px] transition-colors",
        isOver ? "bg-primary/10 border-primary" : "border-border bg-muted/20"
      )}
      style={team ? { borderColor: team.color } : undefined}
    >
      {team ? (
        <Input
          value={team.name}
          onChange={(e) => onRename?.(e.target.value)}
          className="h-7 text-sm font-semibold mb-2 border-0 bg-transparent px-1"
          style={{ color: team.color }}
        />
      ) : (
        <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">
          Nezařazení ({members.length})
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {members.map((p) => (
          <PlayerChip key={p.id} player={p} color={team?.color} />
        ))}
        {members.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Přetáhněte žáky sem</p>
        )}
      </div>
    </div>
  );
};

export const TeamSetup = ({ session, players }: Props) => {
  const { toast } = useToast();
  const kind = session.settings?.teamModeKind ?? "none";
  const initialCount = session.settings?.teamCount ?? 2;

  const [teams, setTeams] = useState<Team[]>(() => {
    const existing = session.teams?.teams;
    if (existing && existing.length > 0) return existing;
    return buildDefaultTeams(initialCount);
  });
  const [count, setCount] = useState(teams.length);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Auto-distribute on first mount for random mode
  useEffect(() => {
    if (kind === "random" && (!session.teams?.teams || session.teams.teams.length === 0)) {
      const next = distributeRandomly(players.map((p) => p.id), initialCount);
      setTeams(next);
      void persist(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const assignedIds = useMemo(() => new Set(teams.flatMap((t) => t.members)), [teams]);
  const unassigned = useMemo(
    () => players.filter((p) => !assignedIds.has(p.id)),
    [players, assignedIds]
  );

  const persist = async (next: Team[]) => {
    setSaving(true);
    const { error } = await supabase
      .from("game_sessions")
      .update({ teams: { teams: next } as any })
      .eq("id", session.id);
    setSaving(false);
    if (error) {
      toast({ title: "Nepodařilo se uložit týmy", description: error.message, variant: "destructive" });
    }
  };

  const handleRandomize = () => {
    const next = distributeRandomly(players.map((p) => p.id), count);
    setTeams(next);
    void persist(next);
    toast({ title: "Žáci rozděleni do týmů" });
  };

  const handleCountChange = (n: number) => {
    setCount(n);
    // Resize teams preserving members where possible
    const base = buildDefaultTeams(n);
    teams.forEach((t, i) => {
      if (i < base.length) {
        base[i] = { ...base[i], name: t.name, color: t.color, members: t.members };
      } else {
        // overflow -> push members to first team
        base[0].members.push(...t.members);
      }
    });
    setTeams(base);
    void persist(base);
  };

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const playerId = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId) return;

    const next = teams.map((t) => ({ ...t, members: t.members.filter((m) => m !== playerId) }));
    if (overId !== UNASSIGNED) {
      const target = next.find((t) => t.id === overId);
      if (target) target.members.push(playerId);
    }
    setTeams(next);
    void persist(next);
  };

  const handleRename = (teamId: string, name: string) => {
    const next = teams.map((t) => (t.id === teamId ? { ...t, name } : t));
    setTeams(next);
    void persist(next);
  };

  const activePlayer = activeId ? players.find((p) => p.id === activeId) : null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-heading font-bold text-lg">Týmy</h3>
          {saving && <span className="text-xs text-muted-foreground">(ukládání…)</span>}
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Počet týmů:</Label>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={count}
            onChange={(e) => handleCountChange(parseInt(e.target.value, 10))}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <Button onClick={handleRandomize} variant="outline" size="sm" className="gap-1">
            <Shuffle className="w-4 h-4" />
            Rozdělit náhodně
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {teams.map((t) => (
            <TeamColumn
              key={t.id}
              id={t.id}
              team={t}
              members={players.filter((p) => t.members.includes(p.id))}
              onRename={(name) => handleRename(t.id, name)}
            />
          ))}
        </div>
        <TeamColumn id={UNASSIGNED} members={unassigned} />
        <DragOverlay>
          {activePlayer ? <PlayerChip player={activePlayer} /> : null}
        </DragOverlay>
      </DndContext>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Save className="w-3 h-3" /> Změny se ukládají automaticky.
      </p>
    </div>
  );
};
