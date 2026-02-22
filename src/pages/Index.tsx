import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import ContentCards from "@/components/ContentCards";
import TextbooksSection from "@/components/TextbooksSection";
import ArticlesSection from "@/components/ArticlesSection";
import AboutSection from "@/components/AboutSection";
import PodcastSection from "@/components/PodcastSection";
import SiteFooter from "@/components/SiteFooter";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <ContentCards />
        <TextbooksSection />
        <ArticlesSection />
        <AboutSection />
        <PodcastSection />
      </main>
      <SiteFooter />
    </div>
  );
};

export default Index;