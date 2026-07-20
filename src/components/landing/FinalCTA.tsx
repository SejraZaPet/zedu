import { useNavigate } from "react-router-dom";
import { Rocket } from "lucide-react";
import { getLandingIcon } from "@/lib/landing-icons";
import { DEFAULT_FINAL_CTA_PROPS, mergeSectionProps } from "@/lib/landing-defaults";

interface FinalCTAProps {
  props?: Partial<typeof DEFAULT_FINAL_CTA_PROPS>;
}

const FinalCTA = ({ props }: FinalCTAProps) => {
  const navigate = useNavigate();
  const p = mergeSectionProps(DEFAULT_FINAL_CTA_PROPS, props);
  const PrimaryIcon = getLandingIcon(p.primary_cta?.icon, Rocket);

  return (
    <section className="w-full py-20 md:py-28 bg-background">
      <div className="container mx-auto max-w-3xl px-4 text-center">
        <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">{p.title}</h2>
        {p.subtitle && <p className="text-muted-foreground mb-8">{p.subtitle}</p>}
        <button
          onClick={() => p.primary_cta?.href && navigate(p.primary_cta.href)}
          className="bg-gradient-brand text-primary-foreground rounded-2xl px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl hover:opacity-90 transition-all inline-flex items-center gap-2"
        >
          <PrimaryIcon className="w-5 h-5" /> {p.primary_cta?.label ?? "Vytvořit účet zdarma"}
        </button>
        {p.secondary_link?.label && (
          <button
            onClick={() => p.secondary_link?.href && navigate(p.secondary_link.href)}
            className="text-primary text-sm mt-4 block mx-auto hover:underline"
          >
            {p.secondary_link.label}
          </button>
        )}
        {p.contact_email && (
          <p className="text-xs text-muted-foreground mt-6">
            Máte otázky? Napište nám na{" "}
            <a href={`mailto:${p.contact_email}`} className="hover:underline">
              {p.contact_email}
            </a>
          </p>
        )}
      </div>
    </section>
  );
};

export default FinalCTA;
