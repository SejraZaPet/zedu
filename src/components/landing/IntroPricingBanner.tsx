import { Rocket, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const stats = [
  { value: "50", label: "míst v zaváděcí nabídce" },
  { value: "1 měsíc", label: "appku vyzkoušíte zdarma" },
  { value: "2-3 roky", label: "zamčená zaváděcí cena" },
];

const IntroPricingBanner = () => {
  const navigate = useNavigate();

  const handlePrimary = () => {
    document.querySelector("#licence")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSecondary = () => {
    navigate("/licence");
  };

  return (
    <div className="mx-auto max-w-[1100px] mb-6 md:mb-8">
      <div className="bg-gradient-brand rounded-2xl p-6 md:p-8 lg:p-10 text-white shadow-xl overflow-hidden">
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium mb-4">
            <Rocket className="w-4 h-4" />
            Právě jsme spustili ZEdu.cz
          </span>

          <h2 className="font-heading text-[26px] md:text-[28px] font-bold leading-tight mb-3">
            Prvních 50 škol získává zaváděcí cenu natrvalo
          </h2>

          <p className="font-body text-[15px] md:text-base text-white/80 max-w-2xl mb-6 leading-relaxed">
            Připojte se mezi první školy a zamkněte si zvýhodněnou cenu na 2 až 3 roky, i když se ceník později zvýší. Učitelé appku používají vždy zdarma.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl mb-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-white/10 rounded-xl border border-white/10 p-4"
              >
                <div className="font-heading text-xl md:text-2xl font-bold">
                  {stat.value}
                </div>
                <div className="text-white/80 text-sm mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={handlePrimary}
              className="bg-white text-secondary-light font-semibold rounded-full px-6 py-3 shadow hover:bg-white/95 transition-all inline-flex items-center justify-center gap-2"
            >
              Získat zaváděcí cenu
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleSecondary}
              className="border border-white text-white font-semibold rounded-full px-6 py-3 hover:bg-white/10 transition-all"
            >
              Zobrazit ceník
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntroPricingBanner;
