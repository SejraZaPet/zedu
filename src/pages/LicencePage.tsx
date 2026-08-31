import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LicensePlansSection from "@/components/LicensePlansSection";
import Seo from "@/components/Seo";

const LicencePage = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Seo
        title="Licence a ceník pro školy | Bezli"
        description="Licence Bezli pro školy, učitele i lektory. Vyberte balíček podle velikosti školy, získejte individuální nabídku a ukázku zdarma."
        path="/licence"
      />
      <SiteHeader />
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto max-w-6xl px-4 md:px-8">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground text-center">
            Licence a ceník Bezli
          </h1>
          <p className="mt-3 text-center text-muted-foreground max-w-2xl mx-auto">
            Přehled licencí pro školy, jednotlivé učitele a lektory.
          </p>
        </div>
        <LicensePlansSection />
      </main>
      <SiteFooter />
    </div>
  );
};

export default LicencePage;
