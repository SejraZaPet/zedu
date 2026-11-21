import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Seo from "@/components/Seo";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const GdprPage = () => {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash]);
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title="Ochrana osobních údajů (GDPR) | Bezli"
        description="Jak Bezli zpracovává osobní údaje učitelů, žáků a rodičů: účel zpracování, práva subjektů a souhlas rodičů."
        path="/gdpr"
      />
      <SiteHeader />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12 w-full" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <h1 className="font-heading text-3xl font-bold mb-6">Zásady ochrany osobních údajů</h1>

        <section className="space-y-4 text-foreground">
          <p>Poslední aktualizace: 21. listopadu 2026</p>

          <h2 className="font-heading text-xl font-semibold mt-6">1. Kdo údaje zpracovává</h2>
          <p>
            Službu Bezli provozuje Kristýna Herinková, IČO 87462273, Růžová 2716, 438 01 Žatec, e-mail{" "}
            <a href="mailto:info@bezli.cz" className="text-primary hover:underline">info@bezli.cz</a>. U osobních
            údajů, které do služby vkládá škola nebo její uživatelé (žáci, učitelé, rodiče, zaměstnanci), je správcem
            škola a Bezli je jejím zpracovatelem. U údajů, které získáváme sami (například poptávky, kontakty
            zákazníků, demo), jsme správcem my.
          </p>

          <h2 className="font-heading text-xl font-semibold mt-6">2. Jaké údaje a proč</h2>
          <p>
            Zpracováváme jen údaje potřebné k poskytování služby: identifikační a kontaktní údaje, údaje o používání
            služby a obsah, který uživatelé sami vytvoří. Účely jsou poskytování služby, plnění smlouvy, komunikace s
            uživateli, zabezpečení služby a plnění právních povinností. Právním základem je podle situace smlouva,
            zákonná povinnost, oprávněný zájem (zabezpečení služby) nebo souhlas.
          </p>

          <h2 className="font-heading text-xl font-semibold mt-6">3. Co neděláme</h2>
          <p>
            Osobní údaje neprodáváme a nepoužíváme je k reklamě. Údaje žáků nepoužíváme pro vlastní účely,
            zpracováváme je jen podle pokynů školy.
          </p>

          <h2 className="font-heading text-xl font-semibold mt-6">4. Komu údaje předáváme</h2>
          <p>
            Údaje mohou zpracovávat naši poskytovatelé technických služeb (hosting a databáze, e-mail, umělá
            inteligence) na základě smluv o zpracování. Seznam poskytovatelů a jejich umístění poskytneme škole ve
            zpracovatelské smlouvě a komukoli na vyžádání na{" "}
            <a href="mailto:info@bezli.cz" className="text-primary hover:underline">info@bezli.cz</a>. Pokud se údaje
            předávají mimo Evropský hospodářský prostor, děje se tak jen při zárukách podle GDPR, například na základě
            standardních smluvních doložek nebo rozhodnutí o odpovídající úrovni ochrany.
          </p>

          <h2 className="font-heading text-xl font-semibold mt-6">5. Jak dlouho údaje uchováváme</h2>
          <p>
            Jen po dobu, která je nutná pro daný účel. Údaje školy uchováváme po dobu trvání smlouvy a po jejím
            skončení je po omezenou dobu zpřístupníme k exportu a poté vymažeme. Provozní záznamy uchováváme jen po
            dobu potřebnou k zabezpečení a ladění služby. Údaje, které musíme uchovávat ze zákona (například účetní
            doklady), uchováváme po dobu stanovenou zákonem. Konkrétní lhůty jsou uvedeny ve smlouvě a v obchodních
            podmínkách.
          </p>
          <p>
            E-mail zadaný v demu použijeme podle souhlasu k připomenutí smazání dema, převodu práce a
            jedné závěrečné zprávě o smazání údajů. Poté e-mail smažeme. Při odvolání souhlasu jej smažeme bez
            dalších zpráv. U starších souhlasů, které závěrečnou zprávu nezahrnovaly, e-mail smažeme se smazáním
            dema a závěrečnou zprávu neposíláme.
          </p>

          <h2 className="font-heading text-xl font-semibold mt-6">6. Vaše práva</h2>
          <p>
            Máte právo na přístup k údajům, jejich opravu, výmaz, omezení zpracování, přenositelnost a právo vznést
            námitku. Souhlas můžete kdykoli odvolat, aniž by tím bylo dotčeno zpracování před odvoláním. Pište na{" "}
            <a href="mailto:info@bezli.cz" className="text-primary hover:underline">info@bezli.cz</a>. Pokud jde o
            údaje zpracovávané pro školu, žádost vyřídí škola, případně vám pomůžeme my. Stížnost můžete podat u Úřadu
            pro ochranu osobních údajů (uoou.gov.cz).
          </p>

          <h2 className="font-heading text-xl font-semibold mt-6">7. Děti</h2>
          <p>
            Službu používají žáci v rámci školy. Souhlas zákonného zástupce u dětí, u kterých je podle zákona
            potřeba, zajišťuje škola.
          </p>

          <h2 className="font-heading text-xl font-semibold mt-6">8. Umělá inteligence</h2>
          <p>
            Některé funkce využívají umělou inteligenci a obsah odeslaný k jejich použití se zpracovává u
            poskytovatelů AI modelů. Do těchto funkcí nevkládejte citlivé údaje. Výstup AI je jen návrh a rozhoduje
            člověk. Nedochází k automatizovanému rozhodování ani profilování s právními účinky.
          </p>

          <h2 className="font-heading text-xl font-semibold mt-6">9. Povinnost poskytnout údaje</h2>
          <p>
            Poskytnutí údajů potřebných k vytvoření účtu a poskytování služby je podmínkou jejího využívání. Bez nich
            službu nelze poskytnout. Poskytnutí údajů nad rámec toho (například e-mailu v demu) je dobrovolné.
          </p>

          <h2 id="cookies" className="font-heading text-xl font-semibold mt-6 scroll-mt-24">10. Cookies a místní úložiště</h2>
          <p>
            Používáme jen technické cookies a místní úložiště prohlížeče nezbytné pro fungování služby (přihlášení,
            nastavení vzhledu a přístupnosti, stav panelů). Ty nevyžadují souhlas. Nepoužíváme reklamní ani sledovací
            cookies. Návštěvnost měříme anonymně vestavěným měřením hostingu, bez cookies a bez ukládání IP adres
            (zobrazené stránky, země, typ zařízení); podrobné údaje se uchovávají 90 dnů, souhrny jeden rok. Vložený
            obsah třetích stran (například videa) může po spuštění nastavovat vlastní cookies.
          </p>

          <p>
            Další informace jsou v obchodních podmínkách (
            <Link to="/podminky" className="text-primary hover:underline">/podminky</Link>).
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default GdprPage;
