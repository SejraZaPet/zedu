import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, CheckCircle2, FolderOpen, Gamepad2, Layers, Loader2, NotebookPen, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import AiContentBadge from "@/components/ai/AiContentBadge";
import { useAuth } from "@/contexts/AuthContext";
import { appendTextPageToNotebook, createNotebook, loadNotebooks, type Notebook } from "@/lib/notebook";
import { saveTextToPortfolio } from "@/lib/portfolio";
import { savePracticeSource } from "@/lib/practice-method";
import { practiceSourceFromBezlaiSummary, summaryPracticeUrl, type BezlaiSummaryDraft } from "@/lib/bezlai-summary";
import { SOURCE_TEXT_LIMIT } from "../../../supabase/functions/_shared/practice-phases";

const NEW_NOTEBOOK = "new";

interface BezlaiSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  draft: BezlaiSummaryDraft | null;
  onDraftChange: (draft: BezlaiSummaryDraft) => void;
  subject?: string;
}

/** AI pouze předvyplní koncept; všechny zápisy spouští žák samostatnými tlačítky. */
export default function BezlaiSummaryDialog({
  open,
  onOpenChange,
  loading,
  error,
  onRetry,
  draft,
  onDraftChange,
  subject,
}: BezlaiSummaryDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notebookPanel, setNotebookPanel] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notebookId, setNotebookId] = useState("");
  const [newNotebookTitle, setNewNotebookTitle] = useState("");
  const [notebookLoading, setNotebookLoading] = useState(false);
  const [notebookLoadError, setNotebookLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"notebook" | "portfolio" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [failedAction, setFailedAction] = useState<"notebook" | "portfolio" | null>(null);
  const [saved, setSaved] = useState<{ kind: "notebook" | "portfolio"; href: string } | null>(null);

  const loadNotebookOptions = useCallback(async () => {
    if (!user) return;
    setNotebookLoading(true);
    setNotebookLoadError(null);
    try {
      const list = await loadNotebooks(user.id);
      setNotebooks(list);
      setNotebookId((current) => current || list[0]?.id || NEW_NOTEBOOK);
      setNewNotebookTitle((current) => current || "Poznámky z Bezlai");
    } catch {
      setNotebookLoadError("Sešity se nepodařilo načíst. Text poznámek zůstal zachovaný.");
    } finally {
      setNotebookLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open && notebookPanel) void loadNotebookOptions();
  }, [open, notebookPanel, loadNotebookOptions]);

  useEffect(() => {
    if (!open) {
      setNotebookPanel(false);
      setSaveError(null);
      setFailedAction(null);
      setSaved(null);
      setBusy(null);
    }
  }, [open]);

  const updateDraft = (patch: Partial<Pick<BezlaiSummaryDraft, "title" | "text">>) => {
    if (!draft) return;
    onDraftChange({ ...draft, ...patch, aiModifiedAt: draft.aiModifiedAt ?? new Date().toISOString() });
    setSaveError(null);
    setSaved(null);
  };

  const saveToNotebook = async () => {
    if (!user || !draft || busy) return;
    const title = draft.title.trim();
    const text = draft.text.trim();
    if (!title || !text) {
      setSaveError("Před uložením doplň název i text poznámek.");
      setFailedAction("notebook");
      return;
    }
    setBusy("notebook");
    setSaveError(null);
    setFailedAction(null);
    try {
      let targetId = notebookId;
      if (!targetId || targetId === NEW_NOTEBOOK) {
        const notebookTitle = newNotebookTitle.trim() || title;
        const created = await createNotebook({ ownerId: user.id, title: notebookTitle, subject: subject || null });
        // Nový sešit ponecháme i při případném selhání vložení; retry už ho nezdvojí.
        setNotebooks((current) => [created, ...current.filter((item) => item.id !== created.id)]);
        setNotebookId(created.id);
        targetId = created.id;
      }
      const page = await appendTextPageToNotebook({
        notebookId: targetId,
        title,
        text,
        aiModifiedAt: draft.aiModifiedAt,
      });
      setSaved({ kind: "notebook", href: `/student/sesit?otevrit=${encodeURIComponent(targetId)}&strana=${encodeURIComponent(page.id)}` });
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Poznámky se nepodařilo vložit do sešitu. Text zůstal zachovaný.");
      setFailedAction("notebook");
    } finally {
      setBusy(null);
    }
  };

  const saveToPortfolio = async () => {
    if (!user || !draft || busy) return;
    if (!draft.title.trim() || !draft.text.trim()) {
      setSaveError("Před uložením doplň název i text poznámek.");
      setFailedAction("portfolio");
      return;
    }
    setBusy("portfolio");
    setSaveError(null);
    setFailedAction(null);
    try {
      await saveTextToPortfolio({
        studentId: user.id,
        title: draft.title,
        text: draft.text,
        subject,
        aiModifiedAt: draft.aiModifiedAt,
      });
      setSaved({ kind: "portfolio", href: "/student/portfolio" });
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Poznámky se nepodařilo uložit do portfolia. Text zůstal zachovaný.");
      setFailedAction("portfolio");
    } finally {
      setBusy(null);
    }
  };

  const startPractice = (kind: "flashcards" | "mcq") => {
    if (!draft) return;
    if (!savePracticeSource(practiceSourceFromBezlaiSummary(draft))) {
      setSaveError("Materiál se nepodařilo připravit v tomto prohlížeči. Text poznámek zůstal zachovaný; zkus to znovu.");
      return;
    }
    navigate(summaryPracticeUrl(kind));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
            Shrnout do poznámek
            {draft && <AiContentBadge aiGenerated aiModifiedAt={draft.aiModifiedAt} />}
          </DialogTitle>
          <DialogDescription>Bezlai připravila koncept. Zkontroluj ho a uprav; nic se neuloží bez tvého kliknutí.</DialogDescription>
        </DialogHeader>

        {loading && <div role="status" className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Bezlai připravuje shrnutí konverzace…</div>}
        {error && !loading && (
          <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 p-4">
            <p className="text-sm">{error}</p>
            <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={onRetry}><RotateCcw className="h-4 w-4" />Zkusit znovu</Button>
          </div>
        )}

        {draft && !loading && !error && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="bezlai-summary-title">Název tématu</Label>
              <Input id="bezlai-summary-title" value={draft.title} maxLength={200} className="mt-1 text-base"
                onChange={(event) => updateDraft({ title: event.target.value })} disabled={Boolean(busy)} />
            </div>
            <div>
              <Label htmlFor="bezlai-summary-text">Hlavní body a zdroje</Label>
              <Textarea id="bezlai-summary-text" value={draft.text} maxLength={SOURCE_TEXT_LIMIT} rows={12} className="mt-1 text-base leading-relaxed"
                onChange={(event) => updateDraft({ text: event.target.value })} disabled={Boolean(busy)} />
              <p className="mt-1 text-xs text-muted-foreground">{draft.text.length} / {SOURCE_TEXT_LIMIT} znaků · Datum vložení doplní sešit nebo portfolio automaticky.</p>
            </div>

            {saveError && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{saveError}</p>}
            {saved && (
              <div role="status" className="flex flex-wrap items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                <span>{saved.kind === "notebook" ? "Poznámky jsou v sešitě." : "Poznámky jsou v portfoliu."}</span>
                <Button asChild variant="outline" size="sm" className="min-h-11"><Link to={saved.href}>{saved.kind === "notebook" ? "Otevřít sešit" : "Otevřít portfolio"}</Link></Button>
              </div>
            )}

            <section aria-labelledby="bezlai-save-destination" className="space-y-3 rounded-lg border border-border p-3">
              <h3 id="bezlai-save-destination" className="text-sm font-semibold">Co chceš s poznámkami udělat?</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={Boolean(busy)} aria-expanded={notebookPanel}
                  onClick={() => {
                    if (!notebookPanel) setNewNotebookTitle((current) => current || draft.title || "Poznámky z Bezlai");
                    setNotebookPanel((value) => !value);
                    setSaveError(null);
                  }}><NotebookPen className="h-4 w-4" />Vložit do sešitu</Button>
                <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={Boolean(busy)} onClick={() => void saveToPortfolio()}>
                  {busy === "portfolio" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                  {failedAction === "portfolio" ? "Zkusit uložit znovu" : "Uložit do portfolia"}
                </Button>
              </div>

              {notebookPanel && (
                <div className="space-y-3 rounded-md bg-muted/40 p-3">
                  {notebookLoadError ? (
                    <div role="alert" className="space-y-2"><p className="text-sm">{notebookLoadError}</p><Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => void loadNotebookOptions()}>Zkusit znovu</Button></div>
                  ) : notebookLoading && notebooks.length === 0 ? (
                    <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Načítám tvoje sešity…</p>
                  ) : (
                    <>
                      <div>
                        <Label htmlFor="bezlai-notebook">Sešit</Label>
                        <SearchableSelect
                          id="bezlai-notebook"
                          value={notebookId}
                          onValueChange={(value) => { setNotebookId(value); setSaveError(null); }}
                          options={[
                            { value: NEW_NOTEBOOK, label: "+ Nový sešit", pinned: true },
                            ...notebooks.map((notebook) => ({ value: notebook.id, label: notebook.title, subtitle: notebook.subject ?? undefined })),
                          ]}
                          placeholder="Vyber sešit"
                          label="Hledat sešit"
                          triggerLabel="Sešit pro poznámky"
                          emptyMessage="Zatím nemáš žádný sešit. Vyber + Nový sešit."
                          disabled={Boolean(busy)}
                          growing
                          showSelectedSubtitle
                        />
                      </div>
                      {notebookId === NEW_NOTEBOOK && (
                        <div>
                          <Label htmlFor="bezlai-new-notebook">Název nového sešitu</Label>
                          <Input id="bezlai-new-notebook" value={newNotebookTitle} maxLength={120} className="mt-1 text-base"
                            placeholder={draft.title || "Poznámky z Bezlai"} onChange={(event) => setNewNotebookTitle(event.target.value)} disabled={Boolean(busy)} />
                        </div>
                      )}
                      <Button type="button" className="min-h-11 w-full gap-2" disabled={Boolean(busy) || !notebookId || (notebookId === NEW_NOTEBOOK && !newNotebookTitle.trim() && !draft.title.trim())} onClick={() => void saveToNotebook()}>
                        {busy === "notebook" ? <Loader2 className="h-4 w-4 animate-spin" /> : failedAction === "notebook" ? <RotateCcw className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                        {failedAction === "notebook" ? "Zkusit vložení znovu" : "Vložit jako novou stránku na konec"}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </section>

            <section aria-labelledby="bezlai-practice-destination" className="space-y-2">
              <h3 id="bezlai-practice-destination" className="text-sm font-semibold">Nebo z poznámek připrav procvičování</h3>
              <p className="text-xs text-muted-foreground">Text se předá jen v této relaci prohlížeče. Kartičky nebo kvíz vytvoříš až dalším potvrzením.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={Boolean(busy) || !draft.text.trim()} onClick={() => startPractice("flashcards")}><Layers className="h-4 w-4" />Udělat kartičky</Button>
                <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={Boolean(busy) || !draft.text.trim()} onClick={() => startPractice("mcq")}><Gamepad2 className="h-4 w-4" />Udělat kvíz</Button>
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={Boolean(busy)}>Zavřít</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
