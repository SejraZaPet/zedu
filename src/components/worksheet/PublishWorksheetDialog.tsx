import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Send, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTeacherClasses } from "@/hooks/useTeacherClasses";
import { useSubjectGroups } from "@/hooks/useSubjectGroups";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worksheetId: string;
  worksheetTitle: string;
  subjectId?: string | null;
  /** Called after successful publish (and optional assignment creation). */
  onPublished?: (info: { assignmentCreated: boolean }) => void;
}

/**
 * Publikování pracovního listu rovnou se zadáním konkrétní třídě nebo skupině,
 * aby žáci list uviděli — samotné publikování je pro ně neviditelné.
 */
export default function PublishWorksheetDialog({
  open, onOpenChange, worksheetId, worksheetTitle, subjectId, onPublished,
}: Props) {
  const { myClasses: teacherClasses } = useTeacherClasses();
  const { groups } = useSubjectGroups();

  const [assign, setAssign] = useState(true);
  const [target, setTarget] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const myClasses = useMemo(() => teacherClasses ?? [], [teacherClasses]);

  const submit = async () => {
    if (assign && !target) {
      toast({ title: "Vyber třídu nebo skupinu", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("Nejsi přihlášená");

      const { error: pubErr } = await supabase
        .from("worksheets" as any)
        .update({ status: "published", scheduled_publish_at: null } as any)
        .eq("id", worksheetId);
      if (pubErr) throw pubErr;

      let assignmentCreated = false;
      if (assign && target) {
        const [kind, targetId] = target.split(":");
        const group = kind === "group" ? groups.find((g) => g.id === targetId) : null;
        const { error: aErr } = await supabase.from("assignments").insert({
          teacher_id: userId,
          title: worksheetTitle || "Pracovní list",
          worksheet_id: worksheetId,
          class_id: kind === "class" ? targetId : null,
          group_id: kind === "group" ? targetId : null,
          subject_id: group?.subject_id ?? subjectId ?? null,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          status: "published",
        } as any);
        if (aErr) throw aErr;
        assignmentCreated = true;
      }

      toast({
        title: "Publikováno",
        description: assignmentCreated
          ? "Pracovní list je zadán a žáci ho vidí."
          : "Pozor: list není nikomu zadán, žáci ho neuvidí.",
      });
      onOpenChange(false);
      onPublished?.({ assignmentCreated });
    } catch (e: any) {
      toast({ title: "Publikování selhalo", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Publikovat pracovní list</DialogTitle>
          <DialogDescription>
            Žáci uvidí pracovní list jen tehdy, když ho zadáte konkrétní třídě nebo skupině.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox
              checked={assign}
              onCheckedChange={(v) => setAssign(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm">Zadat rovnou třídě nebo skupině</span>
          </label>

          {assign ? (
            <>
              <div>
                <Label>Komu zadat *</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte třídu nebo skupinu" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {myClasses.map((c) => (
                      <SelectItem key={c.id} value={`class:${c.id}`}>
                        Třída {c.name}
                      </SelectItem>
                    ))}
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={`group:${g.id}`}>
                        Skupina {g.name}
                        {g.subjectName ? ` · ${g.subjectName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {myClasses.length === 0 && groups.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nemáte zatím žádnou třídu ani skupinu.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="ws-deadline">Termín odevzdání</Label>
                <Input
                  id="ws-deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Nepovinné.</p>
              </div>
            </>
          ) : (
            <div className="flex gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Bez zadání pracovní list žáci ve svém přehledu neuvidí.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button onClick={submit} disabled={busy}>
            <Send className="w-4 h-4 mr-2" />
            {busy ? "Publikuji…" : "Publikovat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
