import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

const navItems = [
  { label: "Učebnice", href: "#ucebnice", protected: true },
  { label: "Ke kávě", href: "#ke-kave", protected: false },
  { label: "Podcast", href: "#podcast", protected: false },
  { label: "O projektu", href: "#o-projektu", protected: false },
];

const SiteHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleProtectedNav = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      navigate("/ucebnice");
    } else {
      navigate("/auth?redirect=%2Fucebnice");
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-background/95 backdrop-blur-md border-b border-border" : "bg-transparent"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between h-16 md:h-20 px-4 md:px-8">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 group cursor-pointer bg-transparent border-none p-0">
          <img src={logo} alt="Sejra za pět" className="h-8 md:h-10 w-auto invert brightness-200" />
          <span className="font-heading text-xl md:text-2xl font-semibold text-foreground tracking-wide group-hover:text-primary transition-colors">
            Sejra<span className="text-primary"> za pět</span>
          </span>
        </button>

        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.protected ? undefined : item.href}
              onClick={item.protected ? (e) => { e.preventDefault(); handleProtectedNav(); } : undefined}
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200 cursor-pointer"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-foreground p-2"
          aria-label="Menu"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-background/98 backdrop-blur-md border-b border-border animate-fade-in">
          <nav className="flex flex-col px-6 py-4 gap-4">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.protected ? undefined : item.href}
                onClick={(e) => {
                  setMenuOpen(false);
                  if (item.protected) { e.preventDefault(); handleProtectedNav(); }
                }}
                className="text-base font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;