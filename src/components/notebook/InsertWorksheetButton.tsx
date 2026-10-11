import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookPlus, FileText, Loader2, PenTool, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { loadNotebooks, type Notebook, type NotebookPage } from "@/lib/notebook";
import {
  findInsertedPages, insertWorksheetIntoNotebook, loadInsertableWorksheets,
  type InsertableWorksheet, type WorksheetInsertMode,
} from "@/lib/worksheet-notebook";

interface Props {
  /** Známý list (plán hodiny, stránka listu, úkol) → vybírá se sešit. */
  worksheetId?: string;
  assignmentId?: string | null;
  /** Známý sešit (MyNotebook) → vybírá se list. */
  notebook?: Notebook | null;
  onInserted?: (notebookId: string, pages: NotebookPage[]) => void;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
}

const MODES: { mode: WorksheetInsertMode; title: string; desc: string; Icon: typeof FileText }[] = [
  { mode: "digital", title: "Digitálně", desc: "Odkaz v sešitě otevře list na A4 se stejnými odpověďmi.", Icon: FileText },
  { mode: "pen", title: "PDF pro pero", desc: "Stránky listu se vloží do sešitu, píšeš na ně perem.", Icon: PenTool },
];

/** „Vložit do sešitu“ — digitálně (odkaz) nebo jako stránky pro pero. Duplicitně nevkládá. */
export default function InsertWorksheetButton({
  worksheetId, assignmentId = null, notebook = null, onInserted, label, size = "sm", variant = "outline",
}: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [nbId, setNbId] = useState<string>(notebook?.id ?? "");
  const [sheets, setSheets] = useState<InsertableWorksheet[]>([]);
  const [wsId, setWsId] = useState<string>(worksheetId ?? "");
  const [query, setQuery] = useState("");
  const [existing, setExisting] = useState<Record<WorksheetInsertMode, NotebookPage[]>>({ digital: [], pen: [] });
  const [busy, setBusy] = useState<WorksheetInsertMode | "load" | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setBusy("load");
    (async () => {
      try {
        if (!notebook) {
          const list = await loadNotebooks(user.id);
          setNotebooks(list);
          setNbId((cur) => cur || list[0]?.id || "");
        }
        if (!worksheetId) setSheets(await loadInsertableWorksheets());
      } catch {
        toast.error("Nepodařilo se načíst nabídku.");
      } finally {
        setBusy(null);
      }
    })();
  }, [open, user, notebook, worksheetId]);

  const targetNotebook = notebook ?? notebooks.find((n) => n.id === nbId) ?? null;
  const selectedSheet = sheets.find((s) => s.id === wsId);
  const effectiveAssignment = assignmentId ?? selectedSheet?.assignmentId ?? null;

  useEffect(() => {
    if (!open || !targetNotebook || !wsId) { setExisting({ digital: [], pen: [] }); return; }
    let c = false;
    Promise.all([
      findInsertedPages(targetNotebook.id, wsId, "digital"),
      findInsertedPages(targetNotebook.id, wsId, "pen"),
    ]).then(([digital, pen]) => { if (!c) setExisting({ digital, pen }); }).catch(() => {});
    return () => { c = true; };
  }, [open, targetNotebook?.id, wsId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sheets.filter((s) => `${s.title} ${s.subject ?? ""}`.toLowerCase().includes(q)) : sheets;
  }, [sheets, query]);

  const openIn = (nb: string, pages: NotebookPage[]) => {
    if (onInserted) onInserted(nb, pages);
    else navigate(`/student/sesit?otevrit=${nb}${pages[0] ? `&strana=${pages[0].id}` : ""}`);
    setOpen(false);
  };

  const run = async (mode: WorksheetInsertMode) => {
    if (!targetNotebook || !wsId) return;
    if (existing[mode].length > 0) return openIn(targetNotebook.id, existing[mode]);
    setBusy(mode);
    try {
      const res = await insertWorksheetIntoNotebook({
        notebook: targetNotebook, worksheetId: wsId, mode, assignmentId: effectiveAssignment,
      });
      toast.success(res.existed ? "List už v sešitě je." : mode === "pen" ? `Vloženo ${res.pages.length} stran.` : "Odkaz na list vložen.");
      openIn(targetNotebook.id, res.pages);
    } catch (e: any) {
      toast.error(e?.message || "Vložení do sešitu se nepodařilo.");
    } finally {
      setBusy(null);
    }
  };

  if (!user) return null;

  return (
    <>
      <Button size={size} variant={variant} className="gap-1.5" onClick={() => setOpen(true)}>
        <BookPlus className="h-4 w-4" /> {label ?? (notebook ? "Vložit pracovní list" : "Vložit do sešitu")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{notebook ? "Vložit pracovní list" : "Vložit do sešitu"}</DialogTitle>
            <DialogDescription>Vyber, jak chceš s listem pracovat.</DialogDescription>
          </DialogHeader>

          {busy === "load" ? (
            <div className="py-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              {!notebook && (
                <div className="space-y-1">
                  <Label>Sešit</Label>
                  {notebooks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Zatím nemáš žádný sešit. Založ si ho v části Sešit.</p>
                  ) : (
                    <Select value={nbId} onValueChange={setNbId}>
                      <SelectTrigger><SelectValue placeholder="Vyber sešit" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {notebooks.map((n) => <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {!worksheetId && (
                <div className="space-y-2">
                  <Label htmlFor="ws-insert-q">Pracovní list</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="ws-insert-q" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat list" />
                  </div>
                  <div className="max-h-56 overflow-y-auto overscroll-contain rounded-md border" role="listbox" aria-label="Pracovní listy">
                    {filtered.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">Žádný dostupný list.</p>
                    ) : filtered.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        role="option"
                        aria-selected={wsId === s.id}
                        onClick={() => setWsId(s.id)}
                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${wsId === s.id ? "bg-muted font-medium" : ""}`}
                      >
                        {s.title}
                        <span className="ml-2 text-xs text-muted-foreground">{[s.subject, s.assignmentId ? "úkol" : null].filter(Boolean).join(" · ")}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                {MODES.map(({ mode, title, desc, Icon }) => {
                  const has = existing[mode].length > 0;
                  return (
                    <Button
                      key={mode}
                      variant="outline"
                      className="h-auto min-h-11 flex-col items-start gap-1 whitespace-normal p-3 text-left"
                      disabled={!targetNotebook || !wsId || !!busy}
                      onClick={() => run(mode)}
                    >
                      <span className="flex items-center gap-1.5 font-semibold">
                        {busy === mode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                        {has ? `Otevřít v sešitě · ${title}` : title}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">{has ? "Už je vložený, nic se nezdvojí." : desc}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
