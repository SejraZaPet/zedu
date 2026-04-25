import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const GdprPage = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full">
        <h1 className="font-heading text-3xl font-bold mb-6">Zásady ochrany osobních údajů</h1>

        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4 mb-8 text-sm text-amber-900 dark:text-amber-200">
          ⚠️ Tento dokument je připravován. Finální verze zásad ochrany osobních údajů bude doplněna po právní konzultaci. Mezitím platí, že ZEdu.cz zpracovává pouze údaje nezbytné pro fungování vzdělávací platformy.
        </div>

        <section className="space-y-4 text-foreground">
          <h2 className="font-heading text-xl font-semibold mt-6">Správce osobních údajů</h2>
          <p>ZEdu.cz – provozovatel vzdělávací platformy. Kontakt: <a href="mailto:info@zedu.cz" className="text-primary hover:underline">info@zedu.cz</a></p>

          <h2 className="font-heading text-xl font-semibold mt-6">Jaké údaje zpracováváme</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Jméno a příjmení</li>
            <li>E-mailová adresa (pokud je zadána)</li>
            <li>Výsledky vzdělávacích aktivit</li>
            <li>Název školy a ročník</li>
          </ul>

          <h2 className="font-heading text-xl font-semibold mt-6">Účel zpracování</h2>
          <p>Údaje jsou zpracovávány výhradně za účelem poskytování vzdělávacích služeb platformy ZEdu.cz.</p>

          <h2 className="font-heading text-xl font-semibold mt-6">Právo na výmaz</h2>
          <p>Máte právo požádat o smazání vašeho účtu a všech souvisejících dat. Kontaktujte nás na <a href="mailto:info@zedu.cz" className="text-primary hover:underline">info@zedu.cz</a>.</p>

          <h2 className="font-heading text-xl font-semibold mt-6">Souhlas rodičů</h2>
          <p>Pro žáky mladší 15 let je vyžadován souhlas zákonného zástupce. Administrátor školy odpovídá za zajištění souhlasů při hromadném importu žáků.</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default GdprPage;
