import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  organizationIds: string[];
}

const CrmBulkEmailDialog = ({ open, onOpenChange, organizationIds }: Props) => {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRecipientCount(null);
    if (organizationIds.length === 0) {
      setRecipientCount(0);
      return;
    }
    (async () => {
      const { count } = await supabase
        .from("crm_contacts")
        .select("id", { count: "exact", head: true })
        .in("organization_id", organizationIds)
        .eq("is_primary", true)
        .eq("marketing_consent", true)
        .is("unsubscribed_at", null);
      setRecipientCount(count ?? 0);
    })();
  }, [open, organizationIds.join(",")]);

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Vyplňte předmět i text e-mailu", variant: "destructive" });
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("crm-bulk-email", {
      body: { organizationIds, subject: subject.trim(), body: body.trim() },
    });
    setSending(false);
    if (error) {
      toast({ title: "Odeslání selhalo", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Hromadný e-mail odeslán",
      description: `Odesláno: ${data?.sent ?? 0}${data?.failed ? `, selhalo: ${data.failed}` : ""}`,
    });
    setSubject("");
    setBody("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Hromadný e-mail</DialogTitle>
          <DialogDescription>
            Odešle se hlavním kontaktům {organizationIds.length} filtrovaných organizací, které mají aktivní souhlas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">
            Příjemců s aktivním souhlasem:{" "}
            <span className="font-medium">{recipientCount === null ? "…" : recipientCount}</span>
          </p>
          <div>
            <Label>Předmět *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label>Text *</Label>
            <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Na konec každého e-mailu se automaticky přidá odkaz pro odhlášení z hromadných zpráv.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button onClick={send} disabled={sending || !recipientCount}>
            {sending ? "Odesílám…" : "Odeslat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CrmBulkEmailDialog;
