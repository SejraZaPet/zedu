import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";

export default function UnpublishedWorksheetWarning({ worksheet, onPublished }: {
  worksheet: { id: string; title: string }; onPublished: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  async function publish() {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Přihlaste se znovu.");
      const { data, error } = await supabase.from("worksheets").update({ status: "published", scheduled_publish_at: null })
        .eq("id", worksheet.id).eq("teacher_id", user.id).in("status", ["draft", "scheduled"]).select("id").maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("List se nepodařilo zveřejnit. Obnovte seznam a ověřte, že je Váš.");
      onPublished(worksheet.id); setConfirm(false);
      toast({ title: "Pracovní list zveřejněn" });
    } catch (e) { toast({ title: "Zveřejnění selhalo", description: e instanceof Error ? e.message : "Zkuste to znovu.", variant: "destructive" }); }
    finally { setBusy(false); }
  }
  return <>
    <div role="alert" className="border-2 border-destructive rounded-lg p-3 space-y-2 min-w-0">
      <p className="flex gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="h-5 w-5 shrink-0" /><span className="break-words">{worksheet.title}: Nezveřejněno – žáci ho neuvidí</span></p>
      <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirm(true)}>Zveřejnit list</Button>
    </div>
    <Dialog open={confirm} onOpenChange={v => { if (!busy) setConfirm(v); }}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Zveřejnit list?</DialogTitle><DialogDescription className="break-words">{worksheet.title} bude zveřejněn ihned. Případné naplánování se zruší. Nevytvoří se žádná nová úloha.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setConfirm(false)}>Zrušit</Button><Button className="min-h-11" disabled={busy} onClick={publish}>{busy ? "Zveřejňuji…" : "Zveřejnit list"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}