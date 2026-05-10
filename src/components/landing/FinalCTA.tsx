import { useNavigate } from "react-router-dom";
import { Rocket } from "lucide-react";

const FinalCTA = () => {
  const navigate = useNavigate();
  return (
    <section className="w-full py-20 md:py-28 bg-background">
      <div className="container mx-auto max-w-3xl px-4 text-center">
        <h2 className="font-heading text-2xl md:text-3xl font-bold mb-4">Připraveni učit moderně?</h2>
        <p className="text-muted-foreground mb-8">Zaregistrujte se zdarma a začněte tvořit.</p>
        <button
          onClick={() => navigate("/auth")}
          className="bg-gradient-brand text-primary-foreground rounded-2xl px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all inline-flex items-center gap-2"
        >
          <Rocket className="w-5 h-5" /> Vytvořit účet zdarma
        </button>
        <button
          onClick={() => navigate("/cenik")}
          className="text-primary text-sm mt-4 block mx-auto hover:underline"
        >
          Zobrazit ceník
        </button>
        <p className="text-xs text-muted-foreground mt-6">
          Máte otázky? Napište nám na{" "}
          <a href="mailto:info@zedu.cz" className="hover:underline">info@zedu.cz</a>
        </p>
      </div>
    </section>
  );
};

export default FinalCTA;
