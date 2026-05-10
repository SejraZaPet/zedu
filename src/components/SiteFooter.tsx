import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import logo from "@/assets/zedu-logo-new.png";
import { useAuth } from "@/contexts/AuthContext";

const SiteFooter = () => {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  return (
    <footer className="border-t border-border px-4 py-12 md:px-8 bg-card">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <div className="mb-3">
              <img src={logo} alt="Zedu" className="h-9 w-auto" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Moderní nástroje pro vzdělávání.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              {isLoggedIn ? "Systém" : "Produkt"}
            </h4>
            <nav className="flex flex-col gap-2">
              {isLoggedIn ? (
                <>
                  <button onClick={() => navigate("/napoveda")} className="text-sm text-muted-foreground hover:text-primary transition-colors text-left">Nápověda</button>
                </>
              ) : (
                <>
                  <a href="#features" className="text-sm text-muted-foreground hover:text-primary transition-colors text-left">Funkce</a>
                  <button onClick={() => navigate("/cenik")} className="text-sm text-muted-foreground hover:text-primary transition-colors text-left">Ceník</button>
                  <button onClick={() => navigate("/napoveda")} className="text-sm text-muted-foreground hover:text-primary transition-colors text-left">Nápověda</button>
                </>
              )}
            </nav>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Právní</h4>
            <nav className="flex flex-col gap-2">
              <button onClick={() => navigate("/gdpr")} className="text-sm text-muted-foreground hover:text-primary transition-colors text-left">GDPR</button>
              <span className="text-sm text-muted-foreground cursor-default">Podmínky používání</span>
              <span className="text-sm text-muted-foreground cursor-default">Cookies</span>
            </nav>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Kontakt</h4>
            <a
              href="mailto:info@zedu.cz"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="w-4 h-4" />
              info@zedu.cz
            </a>
          </div>
        </div>
    </footer>
  );
};

export default SiteFooter;
