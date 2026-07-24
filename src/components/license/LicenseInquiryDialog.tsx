import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, LICENSE_ROLES, type PlanKey } from "@/lib/license-plans";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPlan?: PlanKey;
}

const LicenseInquiryDialog = ({ open, onOpenChange, initialPlan = "Start" }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    organization: "",
    role: "",
    plan: initialPlan as PlanKey,
    studentCount: "",
    message: "",
    website: "", // honeypot
  });

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, plan: initialPlan }));
  }, [open, initialPlan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Vyplňte prosím jméno a e-mail.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Zadejte platný e-mail.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-license-inquiry", {
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          organization: form.organization.trim(),
          role: form.role,
          plan: form.plan,
          studentCount: form.studentCount ? Number(form.studentCount) : "",
          message: form.message.trim(),
          website: form.website,
          startedAt,
        },
      });
      if (error || (data && (data as any).error)) {
        throw new Error(error?.message || (data as any).error || "Nepodařilo se odeslat");
      }
      toast.success("Děkujeme, ozveme se vám co nejdřív");
      onOpenChange(false);
      setForm((f) => ({
        ...f,
        name: "",
        email: "",
        phone: "",
        organization: "",
        role: "",
        studentCount: "",
        message: "",
      }));
    } catch (err: any) {
      toast.error(err?.message || "Odeslání se nepodařilo. Zkuste to prosím znovu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Poptávka licence ZEdu</DialogTitle>
          <DialogDescription>
            Vyplňte formulář a my se vám ozveme s nabídkou na míru.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            style={{ position: "absolute", left: "-9999px", opacity: 0, height: 0, width: 0 }}
            aria-hidden="true"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lic-name">Jméno a příjmení *</Label>
              <Input id="lic-name" required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="lic-email">E-mail *</Label>
              <Input id="lic-email" type="email" required maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="lic-phone">Telefon</Label>
              <Input id="lic-phone" maxLength={50} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="lic-org">Škola / organizace</Label>
              <Input id="lic-org" maxLength={200} value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="lic-role">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger id="lic-role">
                  <SelectValue placeholder="Vyberte roli" />
                </SelectTrigger>
                <SelectContent>
                  {LICENSE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="lic-plan">Balíček</Label>
              <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v as PlanKey })}>
                <SelectTrigger id="lic-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="lic-students">Odhadovaný počet žáků</Label>
              <Input id="lic-students" type="number" min={0} max={100000} value={form.studentCount} onChange={(e) => setForm({ ...form, studentCount: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="lic-msg">Zpráva</Label>
              <Textarea id="lic-msg" rows={4} maxLength={5000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Napište nám, co potřebujete – demo, konzultaci, cenovou nabídku…" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Zrušit</Button>
            <Button type="submit" variant="hero" disabled={submitting}>
              {submitting ? "Odesílám…" : "Odeslat poptávku"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LicenseInquiryDialog;
