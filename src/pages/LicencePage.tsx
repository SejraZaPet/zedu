import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LicensePlansSection from "@/components/LicensePlansSection";

const LicencePage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 pt-24 pb-16">
        <LicensePlansSection />
      </main>
      <SiteFooter />
    </div>
  );
};

export default LicencePage;
