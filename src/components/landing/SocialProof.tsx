import { getLandingIcon } from "@/lib/landing-icons";
import { DEFAULT_SOCIAL_PROOF_PROPS, mergeSectionProps } from "@/lib/landing-defaults";

interface SocialProofProps {
  props?: Partial<typeof DEFAULT_SOCIAL_PROOF_PROPS>;
}

const SocialProof = ({ props }: SocialProofProps) => {
  const p = mergeSectionProps(DEFAULT_SOCIAL_PROOF_PROPS, props);
  const metrics = Array.isArray(p.metrics) ? p.metrics : DEFAULT_SOCIAL_PROOF_PROPS.metrics;
  const badges = Array.isArray(p.badges) ? p.badges : DEFAULT_SOCIAL_PROOF_PROPS.badges;

  return (
    <section className="w-full py-16 md:py-20 bg-background">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {metrics.map((m, i) => {
            const Icon = getLandingIcon(m.icon);
            return (
              <div key={`${m.label}-${i}`} className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl bg-gradient-brand-sm flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="font-heading text-3xl md:text-4xl font-bold bg-gradient-brand bg-clip-text text-transparent">{m.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{m.label}</div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 justify-center mt-8 flex-wrap">
          {badges.map((b, i) => (
            <span
              key={`${b}-${i}`}
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
