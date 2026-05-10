import { Layout, Code, Users, Gift } from "lucide-react";

const metrics = [
  { icon: Layout, value: "56", label: "stránek v aplikaci" },
  { icon: Code, value: "22 000+", label: "řádků kódu" },
  { icon: Users, value: "4", label: "role uživatelů" },
  { icon: Gift, value: "100%", label: "zdarma v betě" },
];

const badges = [
  "🇨🇿 Vytvořeno v České republice",
  "🔒 GDPR ready",
  "⚡ React + Supabase",
];

const SocialProof = () => {
  return (
    <section className="w-full py-16 md:py-20 bg-background">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {metrics.map((m) => (
            <div key={m.label} className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                <m.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="font-heading text-3xl md:text-4xl font-bold text-primary">{m.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-center mt-8 flex-wrap">
          {badges.map((b) => (
            <span
              key={b}
              className="bg-muted/50 text-muted-foreground text-xs px-4 py-2 rounded-full border border-border"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
