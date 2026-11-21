import { useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, ShieldQuestion } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { buildBezlaiTeacherMessage, saveBezlaiMessengerDraft } from "@/lib/bezlai-verification";

type Contact = { id: string; name: string; is_teacher: boolean; class_id: string | null; class_name: string | null };

interface BezlaiTeacherVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: string;
  answer: string;
}

/** Předá jen koncept; kontakty, zakládání konverzací a odeslání řídí stávající messenger. */
export default function BezlaiTeacherVerificationDialog({ open, onOpenChange, question, answer }: BezlaiTeacherVerificationDialogProps) {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setText(buildBezlaiTeacherMessage(question, answer));
    setError(null);
    setLoading(true);
    void (async () => {
      try {
        const { data, error: loadError } = await supabase.rpc("messenger_contacts");
        if (cancelled) return;
        if (loadError) throw loadError;
        setContacts((data ?? []) as Contact[]);
      } catch {
        if (!cancelled) {
          setContacts([]);
          setError("Učitele se nepodařilo načíst. Tvůj text zůstal zachovaný.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, question, answer, retry]);

  const teachers = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; classes: Set<string> }>();
    for (const contact of contacts) {
      if (!contact.is_teacher) continue;
      const current = byId.get(contact.id) ?? { id: contact.id, name: contact.name || "Učitel", classes: new Set<string>() };
      if (contact.class_name) current.classes.add(contact.class_name);
      byId.set(contact.id, current);
    }
    return [...byId.values()].map((teacher) => ({
      value: teacher.id,
      label: teacher.name,
      subtitle: [...teacher.classes].join(", ") || undefined,
    })).sort((a, b) => a.label.localeCompare(b.label, "cs"));
  }, [contacts]);

  useEffect(() => {
    if (teachers.length === 1) setTeacherId(teachers[0].value);
    else if (!teachers.some((teacher) => teacher.value === teacherId)) setTeacherId("");
  }, [teachers, teacherId]);

  const continueToMessages = () => {
    if (!teacherId || !text.trim()) return;
    if (!saveBezlaiMessengerDraft({ teacherId, text: text.trim() })) {
      setError("Koncept se v prohlížeči nepodařilo připravit. Text zkopíruj a otevři Zprávy ručně.");
      return;
    }
    onOpenChange(false);
    navigate("/zpravy?bezlai=1");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldQuestion className="h-5 w-5 text-primary" aria-hidden />Ověřit s učitelem</DialogTitle>
          <DialogDescription>Zkontroluj text a vyber učitele. Nic se neodešlo; odeslání potvrdíš až ve Zprávách.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="bezlai-teacher">Učitel</Label>
            {loading ? <p role="status" className="mt-2 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Načítám povolené kontakty…</p> : (
              <SearchableSelect
                id="bezlai-teacher"
                value={teacherId}
                onValueChange={setTeacherId}
                options={teachers}
                label="Hledat učitele"
                triggerLabel="Učitel pro ověření"
                placeholder={teachers.length ? "Vyber učitele" : "V messengeru nemáš dostupného učitele"}
                disabled={teachers.length === 0}
                growing
              />
            )}
          </div>
          <div>
            <Label htmlFor="bezlai-teacher-message">Text pro učitele</Label>
            <Textarea id="bezlai-teacher-message" value={text} onChange={(event) => setText(event.target.value)} rows={11} maxLength={12000} className="mt-1 text-base" />
          </div>
          {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button type="button" variant="outline" size="sm" className="min-h-11 gap-2" onClick={() => setRetry((value) => value + 1)}><RotateCcw className="h-4 w-4" aria-hidden />Zkusit znovu</Button></div>}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button type="button" className="min-h-11" disabled={!teacherId || !text.trim() || loading} onClick={continueToMessages}>Pokračovat do zpráv</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
