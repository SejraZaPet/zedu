import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TextbooksSection from "@/components/TextbooksSection";

const TextbooksPage = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 pt-20">
        <TextbooksSection />
      </main>
      <SiteFooter />
    </div>
  );
};

export default TextbooksPage;
