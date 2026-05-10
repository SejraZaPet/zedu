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

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <SocialProof />
        <FeaturesGrid />
        <HowItWorks />
        <ForWhom />
        <PlatformShowcase />
        <PodcastSection />
        <FinalCTA />
      </main>
      <SiteFooter />
      <AdminButton />
    </div>
  );
};

export default Index;
