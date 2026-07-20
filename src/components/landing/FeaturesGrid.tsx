import { getLandingIcon } from "@/lib/landing-icons";
import { DEFAULT_FEATURES_GRID_PROPS, mergeSectionProps } from "@/lib/landing-defaults";

interface FeaturesGridProps {
  props?: Partial<typeof DEFAULT_FEATURES_GRID_PROPS>;
}

const FeaturesGrid = ({ props }: FeaturesGridProps) => {
  const p = mergeSectionProps(DEFAULT_FEATURES_GRID_PROPS, props);
  const features = Array.isArray(p.features) ? p.features : DEFAULT_FEATURES_GRID_PROPS.features;
  return (
    <section className="w-full py-20 md:py-28 bg-muted/20">
      <div className="container mx-auto max-w-6xl px-4">
        <h2 className="font-heading text-2xl md:text-3xl font-bold text-center mb-4">{p.title}</h2>
        {p.subtitle && (
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            {p.subtitle}
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = getLandingIcon(f.icon);
            return (
              <div
                key={`${f.title}-${i}`}
                className="bg-card rounded-2xl p-6 border border-border hover:border-primary/20 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-brand-sm flex items-center justify-center mb-4">
                  <Icon size={24} className="text-primary-foreground" />
                </div>
                <h3 className="font-heading text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;
