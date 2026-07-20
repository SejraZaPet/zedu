import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { getLandingIcon } from "@/lib/landing-icons";
import { DEFAULT_FOR_WHOM_PROPS, mergeSectionProps } from "@/lib/landing-defaults";
import Editable from "@/components/landing-edit/Editable";
import { useLandingEditModeOptional } from "@/contexts/LandingEditModeContext";

interface ForWhomProps {
  props?: Partial<typeof DEFAULT_FOR_WHOM_PROPS>;
}

const ForWhom = ({ props }: ForWhomProps) => {
  const navigate = useNavigate();
  const p = mergeSectionProps(DEFAULT_FOR_WHOM_PROPS, props);
  const cards = Array.isArray(p.cards) ? p.cards : DEFAULT_FOR_WHOM_PROPS.cards;
  const editCtx = useLandingEditModeOptional();
  const showSubtitle = !!p.subtitle || !!editCtx?.isEditMode;

  return (
    <section className="w-full py-20 md:py-28 bg-gradient-brand-pastel">
      <div className="container mx-auto max-w-5xl px-4">
        <h2 className="text-foreground font-heading text-2xl md:text-3xl font-bold text-center mb-4">
          <Editable path="title" value={p.title} placeholder="Nadpis sekce" />
        </h2>
        {showSubtitle && (
          <p className="text-muted-foreground text-center mb-12">
            <Editable path="subtitle" value={p.subtitle} placeholder="Podnadpis (volitelný)" multiline />
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {cards.map((c, i) => {
            const Icon = getLandingIcon(c.icon);
            const bullets = Array.isArray(c.bullets) ? c.bullets : [];
            return (
              <div
                key={`${c.title}-${i}`}
                className="bg-card rounded-2xl p-8 text-center shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-brand-sm flex items-center justify-center mx-auto mb-5">
                  <Icon size={28} className="text-primary-foreground" />
                </div>
                <h3 className="font-heading text-lg font-semibold mb-4">{c.title}</h3>
                <ul className="text-left text-sm text-muted-foreground space-y-2 mb-6 flex-1">
                  {bullets.map((b, j) => (
                    <li key={`${b}-${j}`} className="flex items-start">
                      <Check className="w-4 h-4 text-primary mr-2 mt-0.5 shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => c.to && navigate(c.to)}
                  className="bg-gradient-brand-sm text-primary-foreground rounded-xl px-6 py-3 font-semibold mt-auto w-full text-sm hover:opacity-90 transition-opacity"
                >
                  {c.cta}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ForWhom;
