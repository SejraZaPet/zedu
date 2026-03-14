import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X, LogIn, LogOut, User, BookOpen, GraduationCap, LayoutDashboard, Users, BarChart3, HelpCircle, Layers, FolderOpen, Activity, TrendingUp, Gamepad2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/zedu-logo-new.png";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const SiteHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

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

  const getNavItems = (): NavItem[] => {
    if (userRole === "admin") {
      return [
        { label: "Přehled", href: "/admin", icon: LayoutDashboard },
        { label: "Uživatelé", href: "/admin?tab=users", icon: Users },
        { label: "Nápověda", href: "/napoveda", icon: HelpCircle },
      ];
    }
    if (userRole === "teacher") {
      return [
        { label: "Moje učebnice", href: "/ucitel/ucebnice", icon: BookOpen },
        { label: "Živé hry", href: "/ucitel/hry", icon: Gamepad2 },
        { label: "Třídy", href: "/admin?tab=classes", icon: FolderOpen },
        { label: "Výsledky", href: "/admin?tab=results", icon: BarChart3 },
        { label: "Nápověda", href: "/napoveda", icon: HelpCircle },
      ];
    }
    if (isLoggedIn) {
      // student (role = "user")
      return [
        { label: "Moje učebnice", href: "/student/ucebnice", icon: BookOpen },
        { label: "Nápověda", href: "/napoveda", icon: HelpCircle },
      ];
    }
    // not logged in
    return [
      { label: "Učebnice", href: "/ucebnice", icon: BookOpen },
      { label: "Aktivity", href: "/aktivity", icon: Activity },
      { label: "Nápověda", href: "/napoveda", icon: HelpCircle },
    ];
  };

  const navItems = getNavItems();

  const isActive = (href: string) => {
    if (href.includes("?tab=")) {
      const [path, query] = href.split("?");
      return location.pathname === path && location.search === `?${query}`;
    }
    if (href === "/admin") {
      return location.pathname === "/admin" && !location.search;
    }
    return location.pathname.startsWith(href);
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

        <div className="hidden md:flex items-center gap-6">
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.href)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-primary hover:bg-muted/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          {isLoggedIn ? (
            <div className="flex items-center gap-2 ml-2 border-l border-border pl-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/profil")} className={`gap-2 ${location.pathname === "/profil" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"}`}>
                <User size={16} />
                Profil
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                <LogOut size={16} />
                Odhlásit
              </Button>
            </div>
          ) : (
            <Button variant="hero" size="sm" onClick={() => navigate("/auth")} className="gap-2 ml-2">
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
          <nav className="flex flex-col px-6 py-4 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <button
                  key={item.label}
                  onClick={() => { setMenuOpen(false); navigate(item.href); }}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors text-left ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-primary hover:bg-muted/50"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              );
            })}
            <div className="border-t border-border mt-2 pt-2">
              {isLoggedIn ? (
                <>
                  <button onClick={() => { setMenuOpen(false); navigate("/profil"); }} className={`flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors text-left w-full ${location.pathname === "/profil" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"}`}>
                    <User size={18} /> Profil
                  </button>
                  <button onClick={() => { setMenuOpen(false); handleLogout(); }} className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium text-muted-foreground hover:text-primary transition-colors text-left w-full">
                    <LogOut size={18} /> Odhlásit
                  </button>
                </>
              ) : (
                <Button variant="hero" size="default" onClick={() => { setMenuOpen(false); navigate("/auth"); }} className="mt-2 w-full justify-center">
                  <LogIn size={16} /> Přihlásit se
                </Button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;
