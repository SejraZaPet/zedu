import { Mail } from "lucide-react";

const SiteFooter = () => {
  return (
    <footer className="border-t border-border px-4 py-12 md:px-8">
      <div className="container mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <h3 className="font-heading text-lg font-semibold mb-2">
              Sejra <span className="text-primary">za pět</span>
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              S láskou ke gastronomii do učitelské sborovny.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Navigace</h4>
            <nav className="flex flex-col gap-2">
              <a href="#ucebnice" className="text-sm text-muted-foreground hover:text-primary transition-colors">Učebnice</a>
              <a href="#clanky" className="text-sm text-muted-foreground hover:text-primary transition-colors">Články</a>
              <a href="#podcast" className="text-sm text-muted-foreground hover:text-primary transition-colors">Podcast</a>
              <a href="#o-projektu" className="text-sm text-muted-foreground hover:text-primary transition-colors">O projektu</a>
            </nav>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Kontakt</h4>
            <a
              href="mailto:info@sejrazapet.cz"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="w-4 h-4" />
              info@sejrazapet.cz
            </a>
          </div>
        </div>

        <div className="border-t border-border mt-10 pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Sejra za pět. Všechna práva vyhrazena.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;