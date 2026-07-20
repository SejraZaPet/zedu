import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { DEFAULT_PLATFORM_SHOWCASE_PROPS, mergeSectionProps } from "@/lib/landing-defaults";
import Editable from "@/components/landing-edit/Editable";
import { useLandingEditModeOptional } from "@/contexts/LandingEditModeContext";

interface PlatformShowcaseProps {
  props?: Partial<typeof DEFAULT_PLATFORM_SHOWCASE_PROPS>;
}

const PlatformShowcase = ({ props }: PlatformShowcaseProps) => {
  const p = mergeSectionProps(DEFAULT_PLATFORM_SHOWCASE_PROPS, props);
  const tabs = Array.isArray(p.tabs) && p.tabs.length > 0 ? p.tabs : DEFAULT_PLATFORM_SHOWCASE_PROPS.tabs;
  const [active, setActive] = useState(0);
  const current = tabs[Math.min(active, tabs.length - 1)];

  return (
    <section className="w-full py-20 md:py-28 bg-muted/20">
      <div className="container mx-auto max-w-5xl px-4 text-center">
        <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">{p.title}</h2>
        {p.subtitle && <p className="text-muted-foreground mb-12">{p.subtitle}</p>}

        <div className="flex gap-2 justify-center mb-8 flex-wrap">
          {tabs.map((t, i) => (
            <button
              key={`${t.label}-${i}`}
              onClick={() => setActive(i)}
              className={
                active === i
                  ? "bg-gradient-brand-sm text-primary-foreground px-4 py-2 rounded-xl text-sm"
                  : "bg-muted/50 px-4 py-2 rounded-xl text-sm text-muted-foreground cursor-pointer hover:bg-muted"
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl aspect-video max-w-3xl mx-auto overflow-hidden flex flex-col items-center justify-center text-muted-foreground">
          {current?.image_url ? (
            <img src={current.image_url} alt={current.label} className="w-full h-full object-cover" />
          ) : (
            <>
              <ImageIcon className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm">Screenshot bude doplněn — {current?.label}</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default PlatformShowcase;
