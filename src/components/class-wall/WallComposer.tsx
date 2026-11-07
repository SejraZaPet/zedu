import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import AssignmentDescriptionEditor from "@/components/assignments/AssignmentDescriptionEditor";
import AssignmentMaterialsEditor from "@/components/assignments/AssignmentMaterialsEditor";
import { ANNOUNCEMENT_MAX, type AssignmentKind } from "@/lib/assignment-kind";
import { assignmentDescriptionToText } from "@/lib/assignment-description";
import type { WallDraft } from "@/lib/wall-composer";
import { toast } from "sonner";

export default function WallComposer({ teacherId, targetName, onCreate, onPublish }: {
  teacherId: string; targetName: string; onCreate: (kind: AssignmentKind) => void;
  onPublish: (draft: WallDraft, previousId: string | null, onDraftSaved: (id: string) => void) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WallDraft>({ description: "", materials: [], pinned: false, commentsEnabled: true, notifyEmail: false });
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const count = assignmentDescriptionToText(draft.description).length;
  const reset = () => { setOpen(false); setSavedId(null); setDraft({ description: "", materials: [], pinned: false, commentsEnabled: true, notifyEmail: false }); };
  const publish = async () => {
    setBusy(true);
    try { await onPublish(draft, savedId, setSavedId); reset(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Příspěvek se nepodařilo zveřejnit. Zkuste to znovu."); }
    finally { setBusy(false); }
  };
  return <div className="min-w-0 space-y-3 border-b border-border pb-4" data-testid="wall-composer">
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button variant="outline" className="min-h-11 h-auto min-w-0 flex-1 justify-start whitespace-normal text-left" aria-expanded={open} onClick={() => setOpen(true)}>Sdílej něco s třídou…</Button>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="min-h-11 gap-2"><Plus className="h-4 w-4" />Přidat<ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {([['task','Úkol'],['material','Materiál'],['announcement','Oznámení']] as const).map(([k,label]) => <DropdownMenuItem key={k} className="min-h-11" onSelect={() => onCreate(k)}>{label}</DropdownMenuItem>)}
          <DropdownMenuItem className="min-h-11" onSelect={() => setOpen(true)}>Příspěvek</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    {open && <div className="min-w-0 space-y-3 [&_button]:min-h-11 [&_button]:min-w-11 [&_input]:min-h-11">
      <p className="break-words text-sm">Komu: {targetName} · celá třída/skupina</p>
      <AssignmentDescriptionEditor content={draft.description} onChange={description => setDraft(d => ({...d,description}))} />
      <p role="status" className={count > ANNOUNCEMENT_MAX ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{count}/{ANNOUNCEMENT_MAX}</p>
      <AssignmentMaterialsEditor materials={draft.materials} teacherId={teacherId} onChange={materials => setDraft(d => ({...d,materials}))} />
      {([['pinned','Připnout'],['commentsEnabled','Povolit komentáře'],['notifyEmail','Poslat e-mailem']] as const).map(([key,label]) => <label key={key} className="flex min-h-11 items-center gap-2 text-sm"><Checkbox checked={draft[key]} disabled={busy} onCheckedChange={v => setDraft(d => ({...d,[key]:v === true}))} />{label}</label>)}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" disabled={busy} onClick={reset}>Zrušit</Button>
        <Button disabled={busy || !count || count > ANNOUNCEMENT_MAX} onClick={publish}>{busy ? "Zveřejňování…" : "Zveřejnit"}</Button>
      </div>
    </div>}
  </div>;
}