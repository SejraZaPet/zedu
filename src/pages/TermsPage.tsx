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
    <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full min-w-0 print:p-0 print:max-w-none" style={{ paddingTop: "calc(70px + 3rem)" }}>
      <h1 className="font-heading text-3xl font-bold mb-6">Všeobecné obchodní podmínky</h1>
      <MarkdownDocument source={termsSource} />
    </main>
    <div className="print:hidden"><SiteFooter /></div>
  </div>
);
export default TermsPage;
