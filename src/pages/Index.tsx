import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import RolePickerSection from "@/components/RolePickerSection";
import PodcastSection from "@/components/PodcastSection";
import SiteFooter from "@/components/SiteFooter";
import AdminButton from "@/components/AdminButton";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <RolePickerSection />
        <PodcastSection />
      </main>
      <SiteFooter />
      <AdminButton />
    </div>
  );
};

export default Index;