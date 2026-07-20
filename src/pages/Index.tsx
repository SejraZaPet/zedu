import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import SocialProof from "@/components/landing/SocialProof";
import FeaturesGrid from "@/components/landing/FeaturesGrid";
import HowItWorks from "@/components/landing/HowItWorks";
import ForWhom from "@/components/landing/ForWhom";
import PlatformShowcase from "@/components/landing/PlatformShowcase";
import PodcastSection from "@/components/PodcastSection";
import FinalCTA from "@/components/landing/FinalCTA";
import SiteFooter from "@/components/SiteFooter";
import AdminButton from "@/components/AdminButton";
import { useLandingSections, type LandingSectionRow } from "@/hooks/useLandingSections";

const COMPONENT_BY_TYPE: Record<string, React.ComponentType<{ props?: any }>> = {
  hero: Hero,
  social_proof: SocialProof,
  features_grid: FeaturesGrid,
  how_it_works: HowItWorks,
  for_whom: ForWhom,
  platform_showcase: PlatformShowcase,
  podcast: PodcastSection,
  final_cta: FinalCTA,
};

// Fallback order used before the DB responds — matches the original hardcoded layout.
const FALLBACK_ORDER: LandingSectionRow[] = [
  { id: "hero", order_index: 10, section_type: "hero", enabled: true, props: {} },
  { id: "social_proof", order_index: 20, section_type: "social_proof", enabled: true, props: {} },
  { id: "features_grid", order_index: 30, section_type: "features_grid", enabled: true, props: {} },
  { id: "how_it_works", order_index: 40, section_type: "how_it_works", enabled: true, props: {} },
  { id: "for_whom", order_index: 50, section_type: "for_whom", enabled: true, props: {} },
  { id: "platform_showcase", order_index: 60, section_type: "platform_showcase", enabled: true, props: {} },
  { id: "podcast", order_index: 70, section_type: "podcast", enabled: true, props: {} },
  { id: "final_cta", order_index: 80, section_type: "final_cta", enabled: true, props: {} },
];

const Index = () => {
  const { data, isLoading, isError } = useLandingSections();
  // Fall back to defaults during initial load or on error so the page never renders empty.
  const sections = !isLoading && !isError && data && data.length > 0 ? data : FALLBACK_ORDER;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        {sections.map((section) => {
          const Component = COMPONENT_BY_TYPE[section.section_type];
          if (!Component) return null;
          return <Component key={section.id} props={section.props} />;
        })}
      </main>
      <SiteFooter />
      <AdminButton />
    </div>
  );
};

export default Index;
