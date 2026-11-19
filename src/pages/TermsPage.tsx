import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import MarkdownDocument from "@/components/legal/MarkdownDocument";
import termsSource from "@/content/obchodni-podminky.md?raw";

const TermsPage = () => (
  <div className="min-h-screen bg-background flex flex-col">
    <Seo
      title="Všeobecné obchodní podmínky | Bezli"
      description="Všeobecné obchodní podmínky používání vzdělávací platformy Bezli pro školy, učitele a lektory."
      path="/podminky"
    />
    <div className="print:hidden"><SiteHeader /></div>
    <main className="print-area flex-1 max-w-3xl mx-auto px-4 py-12 pt-[calc(70px+3rem)] w-full min-w-0 print:p-0 print:max-w-none">
      <MarkdownDocument source={termsSource} />
    </main>
    <div className="print:hidden"><SiteFooter /></div>
  </div>
);
export default TermsPage;
