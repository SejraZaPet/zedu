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
import { useTeacherClasses } from "@/hooks/useTeacherClasses";
import { useSubjectGroups } from "@/hooks/useSubjectGroups";
import {
  GamePlayer,
  GameSession,
  Team,
  TeamsData,
  buildDefaultTeams,
  distributeRandomly,
  rebalanceTeams,
  autoAssignPlayers,
  shuffleArray,
  type TeamMode,
} from "@/lib/game-types";
import { Shuffle, Save, Users, Scale, UserX, School } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  session: GameSession;
  players: GamePlayer[];
}

const UNASSIGNED = "__unassigned__";

const PlayerChip = ({ player, color }: { player: GamePlayer; color?: string }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: player.id });
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

const AbsentChip = ({ name, onRemove }: { name: string; onRemove: () => void }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border border-dashed border-border text-muted-foreground bg-muted/40">
    {name} <span className="italic">· nepřipojen</span>
    <button
      type="button"
      onClick={onRemove}
      className="ml-1 rounded p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Vynechat žáka ${name}`}
      title="Vynechat z týmu"
    >
      <UserX className="w-3 h-3" />
    </button>
  </span>
);

const TeamColumn = ({
  id,
  team,
  members,
  absent = [],
  onRename,
  onRemoveAbsent,
}: {
  id: string;
  team?: Team;
  members: GamePlayer[];
  absent?: { userId: string; name: string }[];
  onRename?: (name: string) => void;
  onRemoveAbsent?: (userId: string) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-xl border-2 p-3 min-h-[120px] transition-colors",
        isOver ? "bg-primary/10 border-primary" : "border-border bg-muted/20"
      )}
      style={team ? { borderColor: team.color } : undefined}
    >
      {team ? (
        <div className="flex items-center gap-2 mb-2">
          <Input
            value={team.name}
            onChange={(e) => onRename?.(e.target.value)}
            className="h-7 text-sm font-semibold border-0 bg-transparent px-1"
            style={{ color: team.color }}
            aria-label="Název týmu"
          />
          <span className="text-xs text-muted-foreground shrink-0">{members.length} online</span>
        </div>
      ) : (
        <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">
          Nezařazení ({members.length})
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {members.map((p) => (
          <PlayerChip key={p.id} player={p} color={team?.color} />
        ))}
        {absent.map((a) => (
          <AbsentChip key={a.userId} name={a.name} onRemove={() => onRemoveAbsent?.(a.userId)} />
        ))}
        {members.length === 0 && absent.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            {team ? "Čekám na žáky… (lze sem i přetáhnout)" : "Všichni jsou v týmech"}
          </p>
        )}
      </div>
    </div>
  );
};

export const TeamSetup = ({ session, players }: Props) => {
  const { toast } = useToast();
  const kind = (session.settings?.teamModeKind ?? "none") as TeamMode;
  const initialCount = session.settings?.teamCount ?? 2;
  const { classes } = useTeacherClasses() as any;
  const { groups } = useSubjectGroups() as any;

  const [teams, setTeams] = useState<Team[]>(() => {
    const existing = session.teams?.teams;
    return existing && existing.length > 0 ? existing : buildDefaultTeams(initialCount);
  });
  const [rosterSource, setRosterSource] = useState<TeamsData["rosterSource"]>(session.teams?.rosterSource ?? null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);

  // Synchronizace s DB (auto-zařazení nových žáků probíhá mimo tuto komponentu).
  const remoteKey = JSON.stringify(session.teams ?? null);
  useEffect(() => {
    if (saving) return;
    const existing = session.teams?.teams;
    if (existing && existing.length > 0) setTeams(existing);
    setRosterSource(session.teams?.rosterSource ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteKey]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const assignedIds = useMemo(() => new Set(teams.flatMap((t) => t.members)), [teams]);
  const unassigned = useMemo(() => players.filter((p) => !assignedIds.has(p.id)), [players, assignedIds]);
  const onlineUserIds = useMemo(() => new Set(players.map((p) => p.user_id).filter(Boolean) as string[]), [players]);

  const persist = async (next: Team[], source: TeamsData["rosterSource"] = rosterSource) => {
    setTeams(next);
    setSaving(true);
    const { error } = await supabase
      .from("game_sessions")
      .update({ teams: { teams: next, rosterSource: source ?? null } as any })
      .eq("id", session.id);
    setSaving(false);
    if (error) toast({ title: "Nepodařilo se uložit týmy", description: error.message, variant: "destructive" });
  };

  const handleRandomize = () => {
    const onlineIds = players.map((p) => p.id);
    const next = distributeRandomly(onlineIds, teams.length).map((t, i) => ({
      ...t,
      name: teams[i]?.name ?? t.name,
      color: teams[i]?.color ?? t.color,
      roster: undefined,
    }));
    void persist(next, null);
    toast({ title: "Žáci rozděleni do týmů" });
  };

  const handleRebalance = () => {
    void persist(rebalanceTeams(teams, players));
    toast({ title: "Týmy vyrovnány" });
  };

  const handleCountChange = (n: number) => {
    const base = buildDefaultTeams(n);
    teams.forEach((t, i) => {
      if (i < base.length) base[i] = { ...base[i], name: t.name, color: t.color, members: t.members, roster: t.roster };
      else {
        base[i % base.length].members.push(...t.members);
        base[i % base.length].roster = [...(base[i % base.length].roster ?? []), ...(t.roster ?? [])];
      }
    });
    void persist(base);
    void supabase
      .from("game_sessions")
      .update({ settings: { ...(session.settings as any), teamCount: n } })
      .eq("id", session.id);
  };

  /** Načte žáky třídy/skupiny a předem je náhodně rozdělí do týmů. */
  const handleLoadRoster = async (value: string) => {
    if (!value) return;
    const [srcKind, id] = value.split(":") as ["class" | "group", string];
    setLoadingRoster(true);
    try {
      const res =
        srcKind === "class"
          ? await supabase.from("class_members").select("user_id").eq("class_id", id)
          : await supabase.from("subject_group_members").select("student_id").eq("group_id", id);
      if (res.error) throw res.error;
      const userIds = ((res.data as any[]) ?? []).map((r) => r.user_id ?? r.student_id).filter(Boolean);
      if (userIds.length === 0) {
        toast({ title: "Třída/skupina nemá žádné žáky", variant: "destructive" });
        return;
      }
      const { data: profs } = await supabase.from("profiles").select("id, first_name, last_name").in("id", userIds);
      const nameOf = new Map(((profs as any[]) ?? []).map((p) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));
      const roster = shuffleArray(userIds).map((uid) => ({ userId: uid, name: nameOf.get(uid) || "Žák" }));
      const next: Team[] = teams.map((t) => ({ ...t, members: [], roster: [] }));
      roster.forEach((r, i) => next[i % next.length].roster!.push(r));
      const assigned = autoAssignPlayers(next, players, kind) ?? next;
      const label =
        srcKind === "class"
          ? classes?.find((c: any) => c.id === id)?.name
          : groups?.find((g: any) => g.id === id)?.name;
      await persist(assigned, { kind: srcKind, id, name: label ?? "" });
      toast({ title: `Týmy připraveny ze seznamu (${roster.length} žáků)`, description: "Připojení žáci se zařadí sami." });
    } catch (e: any) {
      toast({ title: "Nepodařilo se načíst žáky", description: e?.message, variant: "destructive" });
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleRemoveAbsent = (userId: string) => {
    void persist(teams.map((t) => ({ ...t, roster: t.roster?.filter((r) => r.userId !== userId) })));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const playerId = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId) return;
    const userId = players.find((p) => p.id === playerId)?.user_id;
    const next = teams.map((t) => ({
      ...t,
      members: t.members.filter((m) => m !== playerId),
      // Ruční přesun má přednost před plánem – odebereme žáka z rosteru ostatních týmů.
      roster: userId ? t.roster?.filter((r) => r.userId !== userId) : t.roster,
    }));
    if (overId !== UNASSIGNED) next.find((t) => t.id === overId)?.members.push(playerId);
    void persist(next);
  };

  const handleRename = (teamId: string, name: string) => {
    void persist(teams.map((t) => (t.id === teamId ? { ...t, name } : t)));
  };

  const activePlayer = activeId ? players.find((p) => p.id === activeId) : null;
  const absentTotal = teams.reduce((n, t) => n + (t.roster?.filter((r) => !onlineUserIds.has(r.userId)).length ?? 0), 0);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-4 text-left">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-heading font-bold text-lg">Týmy</h3>
          {saving && <span className="text-xs text-muted-foreground">(ukládání…)</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Label htmlFor="team-count" className="text-sm">Počet týmů:</Label>
          <select
            id="team-count"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={teams.length}
            onChange={(e) => handleCountChange(parseInt(e.target.value, 10))}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <Button onClick={handleRandomize} variant="outline" size="sm" className="gap-1" disabled={players.length === 0}>
            <Shuffle className="w-4 h-4" /> Rozdělit náhodně
          </Button>
          <Button onClick={handleRebalance} variant="outline" size="sm" className="gap-1" disabled={players.length === 0}>
            <Scale className="w-4 h-4" /> Vyrovnat týmy
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-sm">
        <School className="w-4 h-4 text-muted-foreground" />
        <Label htmlFor="team-roster" className="text-sm">Rozdělit předem podle:</Label>
        <select
          id="team-roster"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[12rem]"
          value={rosterSource ? `${rosterSource.kind}:${rosterSource.id}` : ""}
          disabled={loadingRoster}
          onChange={(e) => void handleLoadRoster(e.target.value)}
        >
          <option value="">— vyberte třídu nebo skupinu —</option>
          {(classes ?? []).length > 0 && (
            <optgroup label="Třídy">
              {(classes ?? []).map((c: any) => (
                <option key={c.id} value={`class:${c.id}`}>{c.name}</option>
              ))}
            </optgroup>
          )}
          {(groups ?? []).length > 0 && (
            <optgroup label="Skupiny">
              {(groups ?? []).map((g: any) => (
                <option key={g.id} value={`group:${g.id}`}>{g.name}</option>
              ))}
            </optgroup>
          )}
        </select>
        {absentTotal > 0 && (
          <span className="text-xs text-muted-foreground">
            {absentTotal} žáků zatím nepřipojeno – můžete je vynechat nebo týmy vyrovnat.
          </span>
        )}
      </div>

      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {teams.map((t) => (
            <TeamColumn
              key={t.id}
              id={t.id}
              team={t}
              members={players.filter((p) => t.members.includes(p.id))}
              absent={(t.roster ?? []).filter((r) => !onlineUserIds.has(r.userId))}
              onRename={(name) => handleRename(t.id, name)}
              onRemoveAbsent={handleRemoveAbsent}
            />
          ))}
        </div>
        {unassigned.length > 0 && <TeamColumn id={UNASSIGNED} members={unassigned} />}
        <DragOverlay>{activePlayer ? <PlayerChip player={activePlayer} /> : null}</DragOverlay>
      </DndContext>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Save className="w-3 h-3" />
        {kind === "random"
          ? "Nově připojení žáci se automaticky zařadí do nejmenšího týmu. Změny se ukládají automaticky."
          : "Žáci ze seznamu se zařadí sami, ostatní přetáhněte. Změny se ukládají automaticky."}
        {" "}Body už získané zůstávají žákovi i po přesunu.
      </p>
    </div>
  );
};
