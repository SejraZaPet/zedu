import { useState } from "react";
import { Check, Star, Sparkles } from "lucide-react";
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
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";

type PlanKey = "Start" | "Růst" | "Škola" | "Lektor";

interface Plan {
  key: PlanKey;
  title: string;
  tagline: string;
  highlight?: boolean;
  limits: string[];
  features: string[];
}

const PLANS: Plan[] = [
  {
    key: "Start",
    title: "Start",
    tagline: "Pro menší školy začínající s digitalizací výuky",
    limits: ["3 učitelé zdarma", "2 třídy", "Do 70 aktivních žáků"],
    features: [
      "Učebnice a úkoly",
      "Živé prezentace",
      "Gamifikace a avatar",
      "Rodičovský portál",
      "ZEduMarket (jen prohlížení)",
      "Základní statistiky",
      "E-mailová podpora",
    ],
  },
  {
    key: "Růst",
    title: "Růst",
    tagline: "Pro školy, které chtějí naplno využít potenciál platformy",
    highlight: true,
    limits: ["8 učitelů zdarma", "6 tříd", "Do 250 aktivních žáků"],
    features: [
      "Vše z balíčku Start",
      "Plný přístup do ZEduMarket",
      "Rozšířené statistiky",
      "Rychlejší e-mailová podpora",
    ],
  },
  {
    key: "Škola",
    title: "Škola",
    tagline: "Pro celoškolní nasazení bez limitů",
    limits: ["Neomezeno učitelů", "Neomezeno tříd", "250+ aktivních žáků"],
    features: [
      "Vše z balíčku Růst",
      "Vlastní branding školy (logo, barvy)",
      "DVPP akreditované kurzy",
      "Statistiky a exporty pro vedení školy",
      "Prioritní podpora (telefon)",
    ],
  },
  {
    key: "Lektor",
    title: "Lektor",
    tagline: "Pro samostatné lektory mimo školní strukturu",
    limits: ["1 učitel (vy)", "Do 5 skupin na start", "Platba podle počtu žáků"],
    features: [
      "Učebnice a úkoly",
      "Živé prezentace",
      "Gamifikace a avatar",
      "ZEduMarket",
      "Základní statistiky",
      "E-mailová podpora",
    ],
  },
];

const ROLES = ["Ředitel/ka", "Učitel/ka", "Lektor/ka", "Jiné"] as const;

const LicencePage = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    organization: "",
    role: "",
    plan: "Start" as PlanKey,
    studentCount: "",
    message: "",
    website: "", // honeypot
  });

  const openFor = (plan: PlanKey) => {
    setForm((f) => ({ ...f, plan }));
    setDialogOpen(true);
  };

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
      setDialogOpen(false);
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
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 pt-24 pb-16">
        {/* Hero */}
        <section className="container mx-auto px-4 md:px-8 max-w-6xl text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-sm font-medium mb-5">
            <Sparkles className="w-4 h-4" /> Licence pro školy a lektory
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Vyberte balíček, který sedí vaší škole
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Cenu vždy stavíme na míru podle velikosti školy a potřeb. Napište nám &mdash;
            připravíme vám individuální nabídku a domluvíme ukázku zdarma.
          </p>
        </section>

        {/* Plans grid */}
        <section className="container mx-auto px-4 md:px-8 max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`relative rounded-2xl border bg-card p-6 flex flex-col transition-all hover:shadow-lg ${
                  plan.highlight
                    ? "border-primary shadow-md ring-1 ring-primary/30"
                    : "border-border"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-secondary text-primary-foreground text-xs font-semibold px-3 py-1 shadow">
                      <Star className="w-3 h-3" /> Doporučeno
                    </span>
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1">{plan.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">
                  {plan.tagline}
                </p>

                <ul className="space-y-1.5 mb-4">
                  {plan.limits.map((l) => (
                    <li
                      key={l}
                      className="text-sm font-medium text-foreground"
                    >
                      {l}
                    </li>
                  ))}
                </ul>

                <div className="border-t border-border my-2" />

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <div className="text-center mb-3">
                    <div className="text-lg font-bold text-foreground">
                      Individuální nabídka
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Cena podle velikosti školy
                    </div>
                  </div>
                  <Button
                    variant={plan.highlight ? "hero" : "outline"}
                    className="w-full"
                    onClick={() => openFor(plan.key)}
                  >
                    Napište nám pro více informací
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-10 max-w-2xl mx-auto">
            Nejste si jistí, který balíček je pro vás nejvhodnější? Napište nám &mdash;
            rádi vám pomůžeme vybrat a připravíme demo pro vaše kolegy.
          </p>
        </section>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Poptávka licence ZEdu</DialogTitle>
            <DialogDescription>
              Vyplňte formulář a my se vám ozveme s nabídkou na míru.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot */}
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
                <Input
                  id="lic-name"
                  required
                  maxLength={200}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="lic-email">E-mail *</Label>
                <Input
                  id="lic-email"
                  type="email"
                  required
                  maxLength={255}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="lic-phone">Telefon</Label>
                <Input
                  id="lic-phone"
                  maxLength={50}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="lic-org">Škola / organizace</Label>
                <Input
                  id="lic-org"
                  maxLength={200}
                  value={form.organization}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="lic-role">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v })}
                >
                  <SelectTrigger id="lic-role">
                    <SelectValue placeholder="Vyberte roli" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="lic-plan">Balíček</Label>
                <Select
                  value={form.plan}
                  onValueChange={(v) => setForm({ ...form, plan: v as PlanKey })}
                >
                  <SelectTrigger id="lic-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="lic-students">Odhadovaný počet žáků</Label>
                <Input
                  id="lic-students"
                  type="number"
                  min={0}
                  max={100000}
                  value={form.studentCount}
                  onChange={(e) => setForm({ ...form, studentCount: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="lic-msg">Zpráva</Label>
                <Textarea
                  id="lic-msg"
                  rows={4}
                  maxLength={5000}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Napište nám, co potřebujete – demo, konzultaci, cenovou nabídku…"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Zrušit
              </Button>
              <Button type="submit" variant="hero" disabled={submitting}>
                {submitting ? "Odesílám…" : "Odeslat poptávku"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
};

export default LicencePage;
