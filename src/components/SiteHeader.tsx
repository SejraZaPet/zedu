import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X, LogIn, LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/zedu-logo-new.png";
import { Button } from "@/components/ui/button";

const SiteHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const loadRole = async (userId: string) => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .limit(1);
      setUserRole(data?.[0]?.role || "user");
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      if (session) loadRole(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      if (session) loadRole(session.user.id);
      else setUserRole(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isTeacher = userRole === "teacher";
  const isAdmin = userRole === "admin";

  const navItems = [
    { label: "Učebnice", href: isTeacher ? "/ucitel/ucebnice" : (isLoggedIn ? "/student/ucebnice" : "/ucebnice"), isRoute: true },
    { label: "Aktivity", href: "#aktivity", isRoute: false },
    { label: "Pro žáky", href: "#pro-zaky", isRoute: false },
    ...((isAdmin || isTeacher) ? [{ label: "Administrace", href: "/admin", isRoute: true }] : []),
  ];

  const handleTextbookAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?redirect=%2Fucebnice");
      return;
    }
    navigate(isTeacher ? "/ucitel/ucebnice" : "/ucebnice");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-border/50"
      style={{
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(6px)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        height: "70px",
      }}
    >
      <div className="container mx-auto flex items-center justify-between h-full px-4 md:px-8">
        <button onClick={() => navigate("/")} className="flex items-center justify-center cursor-pointer bg-transparent border-none p-0">
          <img src={logo} alt="Zedu" className="h-9 w-auto" />
        </button>

        <div className="hidden md:flex items-center gap-8">
          <nav className="flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.isRoute ? undefined : item.href}
                onClick={item.isRoute ? (e) => { e.preventDefault(); navigate(item.href); } : undefined}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200 cursor-pointer"
              >
                {item.label}
              </a>
            ))}
          </nav>
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate("/profil")} className="gap-2 text-muted-foreground hover:text-primary">
                <User size={16} />
                Profil
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                <LogOut size={16} />
                Odhlásit
              </Button>
            </div>
          ) : (
            <Button variant="hero" size="sm" onClick={() => navigate("/auth")} className="gap-2">
              <LogIn size={16} />
              Přihlásit se
            </Button>
          )}
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-foreground p-2"
          aria-label="Menu"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-card/98 backdrop-blur-md border-b border-border animate-fade-in">
          <nav className="flex flex-col px-6 py-4 gap-4">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.isRoute ? undefined : item.href}
                onClick={(e) => {
                  setMenuOpen(false);
                  if (item.isRoute) { e.preventDefault(); navigate(item.href); }
                }}
                className="text-base font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              >
                {item.label}
              </a>
            ))}
            {isLoggedIn ? (
              <>
                <button onClick={() => { setMenuOpen(false); navigate("/profil"); }} className="text-base font-medium text-muted-foreground hover:text-primary transition-colors text-left flex items-center gap-2">
                  <User size={16} /> Profil
                </button>
                <button onClick={() => { setMenuOpen(false); handleLogout(); }} className="text-base font-medium text-muted-foreground hover:text-primary transition-colors text-left flex items-center gap-2">
                  <LogOut size={16} /> Odhlásit
                </button>
              </>
            ) : (
              <Button variant="hero" size="default" onClick={() => { setMenuOpen(false); navigate("/auth"); }} className="mt-2 w-full justify-center">
                <LogIn size={16} /> Přihlásit se
              </Button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;
