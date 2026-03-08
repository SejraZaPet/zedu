import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, HelpCircle, Shield, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/zedu-logo-new.png";

const SiteFooter = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setIsLoggedIn(!!session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setIsLoggedIn(!!session));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <footer className="border-t border-border px-4 py-12 md:px-8 bg-card">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="mb-3">
              <img src={logo} alt="Zedu" className="h-9 w-auto" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Moderní nástroje pro vzdělávání.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              {isLoggedIn ? "Systém" : "Navigace"}
            </h4>
            <nav className="flex flex-col gap-2">
              {isLoggedIn ? (
                <>
                  <button onClick={() => navigate("/napoveda")} className="text-sm text-muted-foreground hover:text-primary transition-colors text-left">Nápověda</button>
                  <span className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-default">Podmínky používání</span>
                  <span className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-default">Ochrana osobních údajů</span>
                </>
              ) : (
                <>
                  <a href="#ucebnice" className="text-sm text-muted-foreground hover:text-primary transition-colors">Učebnice</a>
                  <a href="#o-projektu" className="text-sm text-muted-foreground hover:text-primary transition-colors">O projektu</a>
                </>
              )}
            </nav>
          </div>

          {/* Contact */}
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

        <div className="border-t border-border mt-10 pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Zedu. Všechna práva vyhrazena.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
