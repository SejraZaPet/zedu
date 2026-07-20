import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { DEFAULT_HOW_IT_WORKS_PROPS, mergeSectionProps } from "@/lib/landing-defaults";
import Editable from "@/components/landing-edit/Editable";
import { useLandingEditModeOptional } from "@/contexts/LandingEditModeContext";

interface HowItWorksProps {
  props?: Partial<typeof DEFAULT_HOW_IT_WORKS_PROPS>;
}

const HowItWorks = ({ props }: HowItWorksProps) => {
  const navigate = useNavigate();
  const p = mergeSectionProps(DEFAULT_HOW_IT_WORKS_PROPS, props);
  const steps = Array.isArray(p.steps) ? p.steps : DEFAULT_HOW_IT_WORKS_PROPS.steps;
  const editCtx = useLandingEditModeOptional();
  const showSubtitle = !!p.subtitle || !!editCtx?.isEditMode;
  const showCta = !!p.cta?.label || !!editCtx?.isEditMode;

  return (
    <section id={p.anchor_id || "jak-to-funguje"} className="w-full py-20 md:py-28 bg-background">
      <div className="container mx-auto max-w-5xl px-4 text-center">
        <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">
          <Editable path="title" value={p.title} placeholder="Nadpis sekce" />
        </h2>
        {showSubtitle && (
          <p className="text-muted-foreground mb-12">
            <Editable path="subtitle" value={p.subtitle} placeholder="Podnadpis (volitelný)" multiline />
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div key={`${s.title}-${i}`}>
              <div className="w-14 h-14 rounded-full bg-gradient-brand-sm text-primary-foreground text-xl font-bold flex items-center justify-center mx-auto mb-4">
                {s.n ?? i + 1}
              </div>
              <h3 className="font-heading text-lg font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{s.desc}</p>
            </div>
          ))}
        </div>
        {showCta && (
          <button
            onClick={() => p.cta?.href && navigate(p.cta.href)}
            className="bg-gradient-brand text-primary-foreground rounded-2xl px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all mt-12 inline-flex items-center gap-2"
          >
            <Editable path="cta.label" value={p.cta?.label} placeholder="Text tlačítka" /> <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </section>
  );
};

export default HowItWorks;
