import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X, LogIn, LogOut, User, BookOpen, GraduationCap, LayoutDashboard, Users, BarChart3, HelpCircle, Layers, FolderOpen, Activity, TrendingUp, Gamepad2, Settings, CalendarDays, Brain, School, Image as ImageIcon } from "lucide-react";
import logo from "@/assets/zedu-logo-new.png";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useSchoolBranding } from "@/hooks/useSchoolBranding";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const SiteHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isLoggedIn, role: userRole, signOut } = useAuth();
  const { branding } = useSchoolBranding();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const canAccessAdmin = userRole === "admin" || userRole === "teacher";

  const getNavItems = (): NavItem[] => {
    if (userRole === "admin") {
      return [
        { label: "Přehled", href: "/admin", icon: LayoutDashboard },
        { label: "Uživatelé", href: "/admin?tab=users", icon: Users },
        { label: "Nápověda", href: "/napoveda", icon: HelpCircle },
      ];
    }
    if (userRole === "school_admin") {
      return [
        { label: "Správa školy", href: "/skola", icon: School },
        { label: "Nápověda", href: "/napoveda", icon: HelpCircle },
      ];
    }
    if (userRole === "teacher" || userRole === "lektor") {
      return [
        { label: "Přehled", href: "/ucitel", icon: LayoutDashboard },
        { label: "Moje učebnice", href: "/ucitel/ucebnice", icon: BookOpen },
        { label: "Rozvrh", href: "/ucitel/rozvrh", icon: CalendarDays },
        { label: "Živé hry", href: "/ucitel/hry", icon: Gamepad2 },
        { label: "Třídy", href: "/ucitel/tridy", icon: FolderOpen },
        { label: "Média", href: "/ucitel/media", icon: ImageIcon },
        { label: "Výsledky", href: "/ucitel/vysledky", icon: BarChart3 },
        { label: "Nápověda", href: "/napoveda", icon: HelpCircle },
      ];
    }
    if (userRole === "rodic") {
      return [
        { label: "Přehled", href: "/rodic", icon: LayoutDashboard },
        { label: "Profil", href: "/profil", icon: User },
        { label: "Nápověda", href: "/napoveda", icon: HelpCircle },
      ];
    }
    if (isLoggedIn) {
      return [
        { label: "Přehled", href: "/student", icon: LayoutDashboard },
        { label: "Moje učebnice", href: "/student/ucebnice", icon: BookOpen },
        { label: "Rozvrh", href: "/student/rozvrh", icon: CalendarDays },
        { label: "Studijní metody", href: "/student/metody", icon: Brain },
        { label: "Připojit se do hry", href: "/hra/pripojit", icon: Gamepad2 },
        { label: "Nápověda", href: "/napoveda", icon: HelpCircle },
      ];
    }
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
    await signOut();
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
        <button onClick={() => navigate("/")} className="flex items-center justify-center cursor-pointer bg-transparent border-none p-0 gap-3">
          <img src={logo} alt="Zedu" className="h-9 w-auto" />
          {branding?.custom_logo_url && (
            <>
              <span className="h-6 w-px bg-border" aria-hidden />
              <img
                src={branding.custom_logo_url}
                alt={branding.name}
                className="h-8 w-auto max-w-[120px] object-contain"
              />
            </>
          )}
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
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className={`gap-2 ${location.pathname === "/profil" || location.pathname === "/admin" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"}`}>
                    <User size={16} />
                    Profil
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/profil")} className="gap-2 cursor-pointer">
                    <User size={16} />
                    Profil
                  </DropdownMenuItem>
                  {canAccessAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin")} className="gap-2 cursor-pointer">
                      <Settings size={16} />
                      Administrace
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="gap-2 cursor-pointer">
                    <LogOut size={16} />
                    Odhlásit
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
        <div className="md:hidden bg-background border-t border-border animate-fade-in">
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
                  {canAccessAdmin && (
                    <button onClick={() => { setMenuOpen(false); navigate("/admin"); }} className={`flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors text-left w-full ${location.pathname === "/admin" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary"}`}>
                      <Settings size={18} /> Administrace
                    </button>
                  )}
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
