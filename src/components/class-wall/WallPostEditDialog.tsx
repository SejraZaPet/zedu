import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import AssignmentDescriptionEditor from "@/components/assignments/AssignmentDescriptionEditor";
import AssignmentMaterialsEditor from "@/components/assignments/AssignmentMaterialsEditor";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type WallDraft, type WallManagedPost, wallEditPatch, wallErrorReason, wallScheduleIso } from "@/lib/wall-composer";

const COLS = "id, title, description, status, deadline, created_at, lesson_id, worksheet_id, exam_type, scheduled_publish_at, settings, teacher_id";
const toLocal = (iso?: string | null) => { if (!iso) return ""; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

export function WallPostEditDialog({ post, teacherId, onClose, onSaved }: {
  post: (WallManagedPost & { scheduled_publish_at?: string | null }) | null; teacherId: string; onClose: () => void; onSaved: (row: any) => void;
}) {
  const [draft, setDraft] = useState<WallDraft | null>(null);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setDraft(null);
    if (!post) return;
    setWhen(toLocal(post.scheduled_publish_at));
    supabase.from("assignments").select("description, materials, settings").eq("id", post.id).single().then(({ data, error }) => {
      if (error || !data) { toast.error(`Příspěvek se nepodařilo načíst. ${wallErrorReason(error)}`); onClose(); return; }
      const s = (data.settings ?? {}) as Record<string, unknown>;
      setDraft({ description: data.description ?? "", materials: (data.materials as any) ?? [], pinned: s.pinned === true, commentsEnabled: s.commentsEnabled !== false, notifyEmail: false });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);
  const save = async () => {
    if (!post || !draft) return;
    let patch;
    try { patch = wallEditPatch(post, draft, { publishAt: post.status === "scheduled" ? wallScheduleIso(when) : null }); }
    catch (e) { toast.error((e as Error).message); return; }
    setBusy(true);
    const { data, error } = await supabase.from("assignments").update(patch as any).eq("id", post.id).eq("teacher_id", teacherId).select(COLS).single();
    setBusy(false);
    if (error || !data) { console.error("[wall] úprava selhala", { code: error?.code, message: error?.message }); toast.error(`Úpravu se nepodařilo uložit. ${wallErrorReason(error)}`); return; }
    onSaved(data); toast.success("Příspěvek upraven"); onClose();
  };
  return <Dialog open={!!post} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Upravit příspěvek</DialogTitle><DialogDescription>Žákům se znovu nic neodešle.</DialogDescription></DialogHeader>
      {!draft ? <p className="text-sm text-muted-foreground">Načítání…</p> : <div className="min-w-0 space-y-3 [&_button]:min-h-11">
        <AssignmentDescriptionEditor content={draft.description} onChange={description => setDraft(d => d && ({ ...d, description }))} />
        <AssignmentMaterialsEditor materials={draft.materials} teacherId={teacherId} onChange={materials => setDraft(d => d && ({ ...d, materials }))} />
        {([["pinned", "Připnout"], ["commentsEnabled", "Povolit komentáře"]] as const).map(([k, label]) => <label key={k} className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={draft[k]} onCheckedChange={v => setDraft(d => d && ({ ...d, [k]: v === true }))} />{label}</label>)}
        {post?.status === "scheduled" && <label className="block space-y-1 text-sm">Zveřejnit (čas v Česku)<Input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></label>}
      </div>}
      <DialogFooter><Button variant="ghost" className="min-h-11" onClick={onClose}>Zrušit</Button><Button className="min-h-11" disabled={busy || !draft} onClick={save}>{busy ? "Ukládání…" : "Uložit"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function WallPostDeleteDialog({ post, teacherId, onClose, onDeleted }: { post: WallManagedPost | null; teacherId: string; onClose: () => void; onDeleted: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!post) return;
    setBusy(true);
    // Jen vlastní oznámení/příspěvek; úkoly s odevzdáním sem nikdy nevedou (canManageWallPost).
    const { error } = await supabase.from("assignments").delete().eq("id", post.id).eq("teacher_id", teacherId).eq("settings->>kind", "announcement");
    setBusy(false);
    if (error) { console.error("[wall] smazání selhalo", { code: error.code, message: error.message }); toast.error(`Příspěvek se nepodařilo smazat. ${wallErrorReason(error)}`); return; }
    onDeleted(post.id); toast.success("Příspěvek smazán"); onClose();
  };
  return <AlertDialog open={!!post} onOpenChange={(o) => !o && onClose()}>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>Smazat příspěvek?</AlertDialogTitle>
        <AlertDialogDescription>Komentáře k němu se smažou a žáci ho už neuvidí. Nejde to vrátit.</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel className="min-h-11">Zrušit</AlertDialogCancel>
        <AlertDialogAction className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy} onClick={(e) => { e.preventDefault(); run(); }}>Smazat</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
