import { useState } from "react";
import { Check, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, type PlanKey } from "@/lib/license-plans";
import LicenseInquiryDialog from "@/components/license/LicenseInquiryDialog";

const LicensePlansSection = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialPlan, setInitialPlan] = useState<PlanKey>("Start");

  const openFor = (plan: PlanKey) => {
    setInitialPlan(plan);
    setDialogOpen(true);
  };

  return (
    <section id="licence" className="section-padding bg-gradient-surface">
      <div className="container mx-auto max-w-6xl px-4 md:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-sm font-medium mb-5">
            <Sparkles className="w-4 h-4" /> Licence pro školy a lektory
          </div>
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Vyberte balíček, který sedí vaší škole
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Cenu vždy stavíme na míru podle velikosti školy a potřeb. Napište nám —
            připravíme vám individuální nabídku a domluvíme ukázku zdarma.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-2xl border bg-card p-6 flex flex-col transition-all hover:shadow-lg ${
                plan.highlight ? "border-primary shadow-md ring-1 ring-primary/30" : "border-border"
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
              <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">{plan.tagline}</p>

              <ul className="space-y-1.5 mb-4">
                {plan.limits.map((l) => (
                  <li key={l} className="text-sm font-medium text-foreground">{l}</li>
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
                  <div className="text-lg font-bold text-foreground">Individuální nabídka</div>
                  <div className="text-xs text-muted-foreground">Cena podle velikosti školy</div>
                </div>
                <Button variant={plan.highlight ? "hero" : "outline"} className="w-full" onClick={() => openFor(plan.key)}>
                  Napište nám pro více informací
                </Button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-10 max-w-2xl mx-auto">
          Nejste si jistí, který balíček je pro vás nejvhodnější? Napište nám —
          rádi vám pomůžeme vybrat a připravíme demo pro vaše kolegy.
        </p>
      </div>

      <LicenseInquiryDialog open={dialogOpen} onOpenChange={setDialogOpen} initialPlan={initialPlan} />
    </section>
  );
};

export default LicensePlansSection;
