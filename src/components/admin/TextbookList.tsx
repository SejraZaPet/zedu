import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  BookOpen, Copy, Eye, Search, ArrowUpDown, LayoutGrid, List as ListIcon,
  MoreVertical, GripVertical, Archive, ArchiveRestore, Trash2, Share2, RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  softDeleteTextbook, restoreTextbook, permanentlyDeleteTextbook, daysLeftInTrash,
} from "@/lib/textbook-trash";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface Textbook {
  id: string;
  title: string;
  description: string;
  subject: string;
  access_code: string;
  visibility: string;
  created_at: string;
  updated_at?: string;
  archived?: boolean;
  order_index?: number;
  deleted_at?: string | null;
}

interface Props {
  textbooks: Textbook[];
  /** Učebnice v koši (deleted_at != null). Zobrazují se jen v režimu „Koš“. */
  trashedTextbooks?: Textbook[];
  loading: boolean;
  subjects: any[];
  onOpen: (tb: Textbook) => void;
  onCreate: () => void;
  onChanged?: () => void;
  onShare?: (tb: Textbook) => void;
}

type SortKey = "name_asc" | "name_desc" | "created_desc" | "created_asc" | "updated_desc" | "manual";
type ViewMode = "grid" | "list";
type Scope = "active" | "archived" | "trash";

const TextbookList = ({ textbooks, trashedTextbooks = [], loading, subjects, onOpen, onChanged, onShare }: Props) => {
  const { toast } = useToast();
  const [sortBy, setSortBy] = useState<SortKey>("created_desc");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<Scope>("active");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [deleteTarget, setDeleteTarget] = useState<Textbook | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<Textbook | null>(null);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Zkopírováno", description: `Kód ${code} zkopírován do schránky.` });
  };

  const isTrash = scope === "trash";

  const sortedTextbooks = useMemo(() => {
    let result = isTrash ? [...trashedTextbooks] : [...textbooks];
    if (search) result = result.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
    if (!isTrash) result = result.filter(t => scope === "archived" ? !!t.archived : !t.archived);
    if (isTrash) {
      result.sort((a, b) => new Date(b.deleted_at || 0).getTime() - new Date(a.deleted_at || 0).getTime());
      return result;
    }
    switch (sortBy) {
      case "name_asc": result.sort((a, b) => a.title.localeCompare(b.title, "cs")); break;
      case "name_desc": result.sort((a, b) => b.title.localeCompare(a.title, "cs")); break;
      case "created_desc": result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case "created_asc": result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case "updated_desc": result.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()); break;
      case "manual": result.sort((a, b) => (a.order_index || 0) - (b.order_index || 0)); break;
    }
    return result;
  }, [textbooks, trashedTextbooks, sortBy, search, scope, isTrash]);

  const handleArchive = async (id: string, archived: boolean) => {
    const { error } = await supabase.from("teacher_textbooks").update({ archived } as any).eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else {
      toast({ title: archived ? "Učebnice archivována" : "Učebnice obnovena" });
      onChanged?.();
    }
  };

  // Mazání = soft delete do koše. Skutečné DELETE jen z koše (handlePurge).
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await softDeleteTextbook(deleteTarget.id, deleteTarget.title);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Přesunuto do koše", description: "Obnovit lze do 30 dnů v sekci Koš." });
      onChanged?.();
    }
    setDeleteTarget(null);
  };

  const handleRestore = async (tb: Textbook) => {
    const { error } = await restoreTextbook(tb.id, tb.title);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Učebnice obnovena" });
      onChanged?.();
    }
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    const { error } = await permanentlyDeleteTextbook(purgeTarget.id, purgeTarget.title);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Učebnice smazána natrvalo" });
      onChanged?.();
    }
    setPurgeTarget(null);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedTextbooks.findIndex(t => t.id === active.id);
    const newIndex = sortedTextbooks.findIndex(t => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(sortedTextbooks, oldIndex, newIndex);
    // Optimistic: update DB
    await Promise.all(newOrder.map((tb, i) =>
      supabase.from("teacher_textbooks").update({ order_index: i } as any).eq("id", tb.id)
    ));
    onChanged?.();
  };

  if (loading) return <p className="text-muted-foreground">Načítání...</p>;

  if (textbooks.length === 0 && trashedTextbooks.length === 0) {
    return (
      <div className="text-center py-16">
        <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="font-heading text-xl font-semibold mb-2">Zatím nemáte žádné učebnice</h2>
        <p className="text-muted-foreground mb-4">Učebnice se vytvoří automaticky, když přidáte nový předmět v administraci.</p>
      </div>
    );
  }

  const isManual = sortBy === "manual" && !isTrash;

  const Toolbar = (
    <div className="flex flex-wrap items-center gap-2 mb-4 bg-card border border-border rounded-lg p-3">
      <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
        <SelectTrigger className="w-[190px] gap-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Aktivní učebnice</SelectItem>
          <SelectItem value="archived">Archivované</SelectItem>
          <SelectItem value="trash">Koš{trashedTextbooks.length ? ` (${trashedTextbooks.length})` : ""}</SelectItem>
        </SelectContent>
      </Select>

      {!isTrash && (
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-[180px] gap-1">
            <ArrowUpDown className="w-4 h-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Název A → Z</SelectItem>
            <SelectItem value="name_desc">Název Z → A</SelectItem>
            <SelectItem value="created_desc">Nejnovější</SelectItem>
            <SelectItem value="created_asc">Nejstarší</SelectItem>
            <SelectItem value="updated_desc">Naposledy upravené</SelectItem>
            <SelectItem value="manual">Vlastní pořadí</SelectItem>
          </SelectContent>
        </Select>
      )}

      <div className="relative flex-1 min-w-[200px]">
        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Hledat učebnici..." className="pl-9" />
      </div>

      {!isTrash && (
        <div className="flex items-center border border-border rounded-md">
          <Button size="sm" variant={viewMode === "grid" ? "secondary" : "ghost"} className="rounded-r-none" onClick={() => setViewMode("grid")}>
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button size="sm" variant={viewMode === "list" ? "secondary" : "ghost"} className="rounded-l-none" onClick={() => setViewMode("list")}>
            <ListIcon className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );

  const renderActions = (tb: Textbook) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => onOpen(tb)}>
          <Eye className="w-4 h-4 mr-2" /> Otevřít
        </DropdownMenuItem>
        {onShare && (
          <DropdownMenuItem onClick={() => onShare(tb)}>
            <Share2 className="w-4 h-4 mr-2" /> Sdílet
          </DropdownMenuItem>
        )}
        {tb.archived
          ? <DropdownMenuItem onClick={() => handleArchive(tb.id, false)}>
              <ArchiveRestore className="w-4 h-4 mr-2" /> Obnovit
            </DropdownMenuItem>
          : <DropdownMenuItem onClick={() => handleArchive(tb.id, true)}>
              <Archive className="w-4 h-4 mr-2" /> Archivovat
            </DropdownMenuItem>
        }
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(tb)}>
          <Trash2 className="w-4 h-4 mr-2" /> Přesunout do koše
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const GridCard = ({ tb, dragHandleProps, setNodeRef, style }: any) => {
    const matchedSubject = subjects?.find(s => s.slug === tb.subject);
    return (
      <div ref={setNodeRef} style={style} className="bg-card border border-border rounded-xl p-6 hover:shadow-md transition-shadow relative">
        {isManual && (
          <button {...dragHandleProps} className="absolute top-2 left-2 p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing" aria-label="Přesunout">
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <div className="absolute top-2 right-2">{renderActions(tb)}</div>
        <div className="flex items-start justify-between mb-3 mt-4">
          <div className="flex-1 min-w-0 pr-8">
            <div className="flex items-center gap-2 flex-wrap">
              {matchedSubject && (
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: matchedSubject.color }} />
              )}
              <h3 className="font-heading font-semibold text-lg truncate">{tb.title}</h3>
              {tb.archived && <Badge variant="outline" className="text-[10px]">Archivováno</Badge>}
            </div>
            {matchedSubject && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {matchedSubject.grades.map((g: any) => (
                  <Badge key={g.id} variant="secondary" className="text-[10px] px-1.5 py-0">{g.label}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        {tb.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{tb.description}</p>}
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-1 bg-primary/10 rounded-md px-2 py-1">
            <span className="text-xs text-muted-foreground">Kód:</span>
            <span className="font-mono text-sm font-bold text-primary">{tb.access_code}</span>
            <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => copyCode(tb.access_code)}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => onOpen(tb)} className="gap-1">
            <Eye className="w-4 h-4" /> Detail
          </Button>
        </div>
      </div>
    );
  };

  const ListRow = ({ tb, dragHandleProps, setNodeRef, style }: any) => {
    const matchedSubject = subjects?.find(s => s.slug === tb.subject);
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-3 px-3 py-2 border-b border-border hover:bg-muted/40 cursor-pointer"
        onClick={() => onOpen(tb)}
      >
        {isManual && (
          <button {...dragHandleProps} className="p-1 text-muted-foreground cursor-grab active:cursor-grabbing" onClick={(e) => e.stopPropagation()} aria-label="Přesunout">
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        {matchedSubject && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: matchedSubject.color }} />}
        <div className="flex-1 min-w-0 font-medium truncate">{tb.title}</div>
        <div className="text-sm text-muted-foreground hidden sm:block">{matchedSubject?.label ?? tb.subject}</div>
        <div className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded">{tb.access_code}</div>
        {tb.archived && <Badge variant="outline" className="text-[10px]">Archivováno</Badge>}
        {renderActions(tb)}
      </div>
    );
  };

  const TrashRow = ({ tb }: { tb: Textbook }) => {
    const matchedSubject = subjects?.find(s => s.slug === tb.subject);
    const daysLeft = daysLeftInTrash(tb.deleted_at);
    return (
      <div className="flex flex-wrap items-center gap-3 px-3 py-3 border-b border-border">
        <div className="flex-1 min-w-[180px]">
          <div className="font-medium truncate">{tb.title}</div>
          <p className="text-xs text-muted-foreground">
            {matchedSubject?.label ?? tb.subject} · smazáno{" "}
            {tb.deleted_at ? new Date(tb.deleted_at).toLocaleString("cs-CZ") : "—"}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {daysLeft > 0 ? `Zbývá ${daysLeft} dnů` : "Ke smazání"}
        </Badge>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => handleRestore(tb)}>
            <RotateCcw className="w-4 h-4" /> Obnovit
          </Button>
          <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => setPurgeTarget(tb)}>
            <Trash2 className="w-4 h-4" /> Smazat natrvalo
          </Button>
        </div>
      </div>
    );
  };

  const SortableItem = ({ tb, render }: { tb: Textbook; render: (props: any) => JSX.Element }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tb.id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };
    return render({ tb, setNodeRef, style, dragHandleProps: { ...attributes, ...listeners } });
  };

  const renderContent = () => {
    if (isTrash) {
      if (sortedTextbooks.length === 0) {
        return (
          <div className="text-center py-12 text-muted-foreground">
            <Trash2 className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p className="text-sm">Koš je prázdný.</p>
          </div>
        );
      }
      return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-muted/40 text-xs text-muted-foreground">
            Smazané učebnice se po 30 dnech odstraní natrvalo.
          </div>
          {sortedTextbooks.map(tb => <TrashRow key={tb.id} tb={tb} />)}
        </div>
      );
    }
    if (sortedTextbooks.length === 0) {
      return <p className="text-sm text-muted-foreground py-8 text-center">Žádné učebnice neodpovídají filtrům.</p>;
    }
    if (viewMode === "grid") {
      const items = sortedTextbooks.map(tb =>
        isManual
          ? <SortableItem key={tb.id} tb={tb} render={(p) => <GridCard {...p} />} />
          : <GridCard key={tb.id} tb={tb} />
      );
      return <div className="grid gap-4 md:grid-cols-2">{items}</div>;
    }
    const rows = sortedTextbooks.map(tb =>
      isManual
        ? <SortableItem key={tb.id} tb={tb} render={(p) => <ListRow {...p} />} />
        : <ListRow key={tb.id} tb={tb} />
    );
    return <div className="bg-card border border-border rounded-xl overflow-hidden">{rows}</div>;
  };

  return (
    <>
      {Toolbar}
      {isManual ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sortedTextbooks.map(t => t.id)}
            strategy={viewMode === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
          >
            {renderContent()}
          </SortableContext>
        </DndContext>
      ) : renderContent()}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Přesunout do koše</AlertDialogTitle>
            <AlertDialogDescription>
              Učebnice „{deleteTarget?.title}" se přesune do koše. Zůstane tam 30 dnů a můžete ji kdykoli obnovit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Přesunout do koše
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!purgeTarget} onOpenChange={(open) => { if (!open) setPurgeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat natrvalo</AlertDialogTitle>
            <AlertDialogDescription>
              Učebnice „{purgeTarget?.title}" se smaže včetně všech lekcí. Tato akce je nevratná.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handlePurge} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Smazat natrvalo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TextbookList;
