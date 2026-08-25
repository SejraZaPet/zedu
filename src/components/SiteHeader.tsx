import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X, LogIn, LogOut, User, BookOpen, GraduationCap, LayoutDashboard, Users, BarChart3, HelpCircle, Layers, FolderOpen, Activity, TrendingUp, Gamepad2, Settings, CalendarDays, Brain, School, Image as ImageIcon, ShoppingBag, UserCheck, BookMarked, ClipboardList, Library, Zap, NotebookPen, Award } from "lucide-react";
import logo from "@/assets/bezli-logo.png";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMySchool } from "@/hooks/useMySchool";
import { useAuth } from "@/contexts/AuthContext";
import NotificationBell from "@/components/notifications/NotificationBell";
import { useSchoolBranding } from "@/hooks/useSchoolBranding";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface TeacherExtraNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface TeacherMenuGroup {
  title: string;
  items: TeacherExtraNavItem[];
}

/** Skupiny v rozbalovacím "Menu" učitele — logicky sdružené nástroje. */
const TEACHER_MENU_GROUPS: TeacherMenuGroup[] = [
  {
    title: "Předměty a skupiny",
    items: [
      { label: "Moje předměty", href: "/ucitel/predmety", icon: GraduationCap },
      { label: "Skupiny předmětu", href: "/ucitel/skupiny", icon: Users },
      { label: "ŠVP k předmětům", href: "/ucitel/svp", icon: BookMarked },
    ],
  },
  {
    title: "Nástroje pro hodiny",
    items: [
      { label: "Rubriky hodnocení", href: "/ucitel/rubriky", icon: ClipboardList },
      { label: "Banka otázek", href: "/ucitel/banka-otazek", icon: Library },
      { label: "BezliStart", href: "/ucitel/bezlistart", icon: Zap },
    ],
  },
  {
    title: "Obsah a knihovna",
    items: [
      { label: "Moje učebnice", href: "/ucitel/ucebnice", icon: BookOpen },
      { label: "Média", href: "/ucitel/media", icon: ImageIcon },
      { label: "Sdíleno se mnou", href: "/ucitel/sdileno-se-mnou", icon: Layers },
      { label: "Sledovaní tvůrci", href: "/ucitel/sledovani-tvurci", icon: UserCheck },
      { label: "BezliMarket", href: "/bezlimarket", icon: ShoppingBag },
    ],
  },
  {
    title: "Aktivity a výsledky",
    items: [
      { label: "Živé hry", href: "/ucitel/hry", icon: Gamepad2 },
      { label: "Výsledky", href: "/ucitel/vysledky", icon: BarChart3 },
      { label: "Bezli Akademie", href: "/ucitel/akademie", icon: Award },
    ],
  },
  {
    title: "Škola",
    items: [{ label: "Porady školy", href: "/ucitel/porady", icon: ClipboardList }],
  },
];

const SCHOOL_ONLY_GROUP = "Škola";


const ACADEMY_BY_ROLE: Record<string, string> = {
  user: "/student/akademie",
  rodic: "/rodic/akademie",
};


const SiteHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { isLoggedIn, role: userRole, signOut } = useAuth();
  const { isStaff } = useStaffPermissions();
  const { branding } = useSchoolBranding();
  const { hasSchool } = useMySchool();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const canAccessAdmin = userRole === "admin" || userRole === "teacher";

  // Skupina "Škola" (porady, školní agenda) patří jen učitelům pod licencí školy.
  const teacherMenuGroups = TEACHER_MENU_GROUPS.filter(
    (g) => g.title !== SCHOOL_ONLY_GROUP || hasSchool,
  );
  const teacherExtraItems: TeacherExtraNavItem[] = teacherMenuGroups.flatMap((g) => g.items);

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
    // Interní zaměstnanec má přednost před pedagogickou rolí — patří do administrace.
    if (isLoggedIn && isStaff) {
      return [
        { label: "Můj panel", href: "/admin", icon: LayoutDashboard },
        { label: "Profil", href: "/profil", icon: User },
        { label: "Nápověda", href: "/napoveda", icon: HelpCircle },
      ];
    }
    if (userRole === "teacher" || userRole === "lektor") {
      return [
        { label: "Přehled", href: "/ucitel", icon: LayoutDashboard },
        { label: "Výuka", href: "/ucitel/predmety", icon: GraduationCap },
        { label: "Rozvrh", href: "/ucitel/rozvrh", icon: CalendarDays },
        { label: "Kalendář", href: "/ucitel/kalendar", icon: CalendarDays },
        { label: "Třídy", href: "/ucitel/tridy", icon: FolderOpen },
        { label: "Můj sešit", href: "/ucitel/sesit", icon: NotebookPen },
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
        { label: "Portfolio", href: "/student/portfolio", icon: FolderOpen },
        { label: "Moje knihy", href: "/student/knihy", icon: BookMarked },
        { label: "Můj sešit", href: "/student/sesit", icon: NotebookPen },
        { label: "Připojit se do hry", href: "/hra/pripojit", icon: Gamepad2 },
        { label: "Nápověda", href: "/napoveda", icon: HelpCircle },
      ];
    }
    return [
      { label: "Učebnice", href: "/ucebnice", icon: BookOpen },
      { label: "Aktivity", href: "/aktivity", icon: Activity },
      { label: "Pro školy", href: "/licence#licence", icon: School },
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

  const handleNavClick = (href: string) => {
    if (href.includes("#")) {
      const [path, hash] = href.split("#");
      if (path === "/licence" && location.pathname === "/") {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
        return;
      }
    }
    navigate(href);
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
          <img src={logo} alt="Bezli" className="h-9 w-auto" />
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
                  onClick={() => handleNavClick(item.href)}
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
                    Menu
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
                  {(userRole === "teacher" || userRole === "lektor") && (
                    <>
                      {teacherMenuGroups.map((group) => (
                        <div key={group.title}>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                            {group.title}
                          </DropdownMenuLabel>
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            return (
                              <DropdownMenuItem
                                key={item.href}
                                onClick={() => navigate(item.href)}
                                className="gap-2 cursor-pointer"
                              >
                                <Icon size={16} />
                                {item.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </div>
                      ))}
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {ACADEMY_BY_ROLE[userRole ?? ""] && (
                    <DropdownMenuItem onClick={() => navigate(ACADEMY_BY_ROLE[userRole ?? ""])} className="gap-2 cursor-pointer">
                      <Award size={16} />
                      Bezli Akademie
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
                  onClick={() => { setMenuOpen(false); handleNavClick(item.href); }}
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
            {(userRole === "teacher" || userRole === "lektor") && (
              teacherExtraItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname.startsWith(item.href);
                return (
                  <button
                    key={item.href}
                    onClick={() => { setMenuOpen(false); navigate(item.href); }}
                    className={`flex items-center gap-3 pl-6 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-primary hover:bg-muted/50"
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })
            )}
            {isLoggedIn && ACADEMY_BY_ROLE[userRole ?? ""] && (
              <button
                onClick={() => { setMenuOpen(false); navigate(ACADEMY_BY_ROLE[userRole ?? ""]); }}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors text-left text-muted-foreground hover:text-primary hover:bg-muted/50"
              >
                <Award className="w-5 h-5" /> Bezli Akademie
              </button>
            )}
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
