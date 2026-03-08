import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import ContentCards from "@/components/ContentCards";
import ArticlesSection from "@/components/ArticlesSection";
import AboutSection from "@/components/AboutSection";
import PodcastSection from "@/components/PodcastSection";
import SiteFooter from "@/components/SiteFooter";
import AdminButton from "@/components/AdminButton";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <ContentCards />
        
        <ArticlesSection />
        <AboutSection />
        <PodcastSection />
      </main>
      <SiteFooter />
      <AdminButton />
    </div>
  );
};

export default Index;