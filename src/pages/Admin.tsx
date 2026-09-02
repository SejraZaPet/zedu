import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye } from "lucide-react";
import LessonOutlineGenerator from "@/components/admin/LessonOutlineGenerator";
import MCQGenerator from "@/components/admin/MCQGenerator";
import MatchingGenerator from "@/components/admin/MatchingGenerator";
import SlideEditor from "@/components/admin/SlideEditor";
import VideoCheckpointGenerator from "@/components/admin/VideoCheckpointGenerator";
import LessonsManager from "@/components/admin/LessonsManager";
import TextbooksManager from "@/components/admin/TextbooksManager";
import TeacherTextbooksManager from "@/components/admin/TeacherTextbooksManager";
import HelpGuidesManager from "@/components/admin/HelpGuidesManager";
import AdminHelpManager from "@/components/admin/AdminHelpManager";
import SubjectsManager from "@/components/admin/SubjectsManager";
import UsersManager from "@/components/admin/UsersManager";
import ClassesManager from "@/components/admin/ClassesManager";
import ClassResultsManager from "@/components/admin/ClassResultsManager";
import AdminDashboard from "@/components/admin/AdminDashboard";
import NotificationsManager from "@/components/admin/NotificationsManager";
import SystemStats from "@/components/admin/SystemStats";
import AuditLogViewer from "@/components/admin/AuditLogViewer";
import TextbookTemplatesManager from "@/components/admin/TextbookTemplatesManager";
import LandingPageManager from "@/components/admin/LandingPageManager";
import AvatarItemsManager from "@/components/admin/AvatarItemsManager";
import GameBackgroundsManager from "@/components/admin/GameBackgroundsManager";
import TextbookOverviewManager from "@/components/admin/TextbookOverviewManager";
import AcademyCoursesManager from "@/components/admin/AcademyCoursesManager";
import AcademyEvidenceReviewManager from "@/components/admin/AcademyEvidenceReviewManager";
import AcademyPathwaysManager from "@/components/admin/AcademyPathwaysManager";
import SchoolLicensesManager from "@/components/admin/SchoolLicensesManager";
import UnassignedTeachersManager from "@/components/admin/UnassignedTeachersManager";
import CrmManager from "@/components/admin/CrmManager";
import MarketplaceEconomicsManager from "@/components/admin/MarketplaceEconomicsManager";
import WebsiteAssistantManager from "@/components/admin/WebsiteAssistantManager";
import MyStaffPanel from "@/components/admin/MyStaffPanel";
import StaffKnowledgeManager from "@/components/admin/StaffKnowledgeManager";
import SchoolsManager from "@/components/admin/SchoolsManager";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { Button } from "@/components/ui/button";
import { BookOpen, LogOut, Home, GraduationCap, Settings, Users, School, BarChart3, LayoutDashboard, HelpCircle, ListTree, CircleHelp, Link2, Pencil, Video, Bell, Activity, FileText, Sparkles, Globe, Smile, Library, Award, FileBadge2, Contact, ChevronDown, Coins, UserSquare2, Image as ImageIcon, Bot } from "lucide-react";

/** `module` = klíč oprávnění (null = viditelné vždy, "admin_only" = jen admin) */
const adminTabs = [
  { id: "dashboard", label: "Přehled", icon: LayoutDashboard, module: null },
  { id: "my-panel", label: "Můj panel", icon: UserSquare2, module: null },
  { id: "staff-academy", label: "Interní akademie", icon: BookOpen, module: null },
  { id: "crm", label: "CRM", icon: Contact, module: "crm" },
  { id: "stats", label: "Statistiky", icon: Activity, module: "stats" },
  { id: "schools", label: "Školy", icon: School, module: "admin_only" },
  { id: "licenses", label: "Spolupracující organizace", icon: Award, module: "school_licenses" },
  { id: "unassigned-teachers", label: "Nepřiřazení učitelé", icon: UserSquare2, module: "school_licenses" },
  { id: "market-economics", label: "Ekonomika BezliMarket", icon: Coins, module: "billing" },

  { id: "users", label: "Uživatelé", icon: Users, module: "users" },
  { id: "textbook-overview", label: "Přehled učebnic", icon: Library, module: "textbook_overview" },
  { id: "academy", label: "Akademie", icon: Award, module: "academy" },
  { id: "academy-pathways", label: "Kvalifikace", icon: GraduationCap, module: "academy" },
  { id: "academy-evidence", label: "Posouzení důkazů", icon: FileBadge2, module: "academy" },
  { id: "templates", label: "Šablony", icon: Sparkles, module: "templates" },
  { id: "landing", label: "Landing page", icon: Globe, module: "landing" },
  { id: "avatars", label: "Avatary", icon: Smile, module: "avatar_manager" },
  { id: "game-backgrounds", label: "Herní pozadí", icon: ImageIcon, module: "avatar_manager" },
  { id: "notifications", label: "Notifikace", icon: Bell, module: "notifications" },
  { id: "website-assistant", label: "Bezlai web", icon: Bot, module: "website_assistant" },
  { id: "audit", label: "Audit log", icon: FileText, module: "audit" },
  { id: "help", label: "Nápověda", icon: HelpCircle, module: null },
] as const;

const teacherTabs = [
  { id: "dashboard", label: "Přehled", icon: LayoutDashboard, module: null },
  { id: "textbooks", label: "Učebnice", icon: GraduationCap, module: null },
  { id: "lessons", label: "Lekce", icon: BookOpen, module: null },
  { id: "outline", label: "Osnova AI", icon: ListTree, module: null },
  { id: "mcq", label: "MCQ AI", icon: CircleHelp, module: null },
  { id: "matching", label: "Matching AI", icon: Link2, module: null },
  { id: "slide-edit", label: "Editor AI", icon: Pencil, module: null },
  { id: "video-ai", label: "Video AI", icon: Video, module: null },
  { id: "subjects", label: "Předměty", icon: Settings, module: null },
  { id: "classes", label: "Třídy", icon: School, module: null },
  { id: "results", label: "Výsledky", icon: BarChart3, module: null },
  { id: "help", label: "Nápověda", icon: HelpCircle, module: null },
] as const;

type Tab = "dashboard" | "my-panel" | "staff-academy" | "stats" | "textbooks" | "lessons" | "outline" | "mcq" | "matching" | "slide-edit" | "video-ai" | "subjects" | "users" | "classes" | "results" | "help" | "notifications" | "licenses" | "audit" | "templates" | "landing" | "avatars" | "game-backgrounds" | "textbook-overview" | "academy" | "academy-pathways" | "academy-evidence" | "crm" | "market-economics" | "unassigned-teachers" | "website-assistant" | "schools";

/** Dvouúrovňová navigace administrace. `help` a `dashboard` řešíme mimo/uvnitř kategorií. */
const adminGroups: { id: string; label: string; tabs: string[] }[] = [
  { id: "overview", label: "Přehled", tabs: ["dashboard", "stats"] },
  { id: "sales", label: "Prodej a zákazníci", tabs: ["crm", "schools", "licenses", "unassigned-teachers", "market-economics"] },
  { id: "content", label: "Vzdělávací obsah", tabs: ["textbook-overview", "templates"] },
  { id: "academy", label: "Bezli Akademie", tabs: ["academy", "academy-pathways", "academy-evidence"] },
  { id: "appearance", label: "Vzhled webu", tabs: ["landing", "avatars", "game-backgrounds"] },
  { id: "system", label: "Systém", tabs: ["notifications", "website-assistant", "audit"] },
];

const Admin = () => {
  const { isAdmin, isStaff, isTeacher, loading, logout } = useAdmin();
  const { can, isAdmin: isRealAdmin, loading: permsLoading, hasAnyPermission } = useStaffPermissions();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const initialTab = tabParam || "dashboard";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  /** Členové týmu bez admin práv startují na svém osobním panelu */
  const [defaultApplied, setDefaultApplied] = useState(false);
  useEffect(() => {
    if (defaultApplied || permsLoading || isTeacher || tabParam) return;
    setDefaultApplied(true);
    if (!isRealAdmin && hasAnyPermission) setActiveTab("my-panel");
  }, [defaultApplied, permsLoading, isTeacher, tabParam, isRealAdmin, hasAnyPermission]);


  const tabs = useMemo(() => {
    if (isTeacher) return teacherTabs;
    return adminTabs.filter((t) => {
      if (t.module === null) return true;
      if (t.module === "admin_only") return isRealAdmin;
      return can(t.module);
    });
  }, [isTeacher, isRealAdmin, can]);

  type TabItem = (typeof adminTabs)[number] | (typeof teacherTabs)[number];

  /** Kategorie s alespoň jednou dostupnou podzáložkou */
  const groups = useMemo(() => {
    if (isTeacher) return [];
    return adminGroups
      .map((g) => ({
        ...g,
        items: g.tabs
          .map((id) => (tabs as readonly TabItem[]).find((t) => t.id === id))
          .filter(Boolean) as TabItem[],
      }))
      .filter((g) => g.items.length > 0);
  }, [isTeacher, tabs]);
  const usersTab = useMemo(
    () => (tabs as readonly TabItem[]).find((tab) => tab.id === "users") ?? null,
    [tabs],
  );

  const activeGroupId = useMemo(
    () => groups.find((g) => g.items.some((i) => i.id === activeTab))?.id ?? groups[0]?.id ?? null,
    [groups, activeTab],
  );
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const currentGroup =
    collapsed || ((activeTab === "help" || activeTab === "users" || activeTab === "my-panel" || activeTab === "staff-academy") && !openGroupId)
      ? null
      : groups.find((g) => g.id === (openGroupId ?? activeGroupId)) ?? null;


  const toggleGroup = (id: string) => {
    if (currentGroup?.id === id) {
      setCollapsed(true);
      return;
    }
    setCollapsed(false);
    setOpenGroupId(id);
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Ověřování přístupu...</p>
      </div>
    );
  }

  if (!isAdmin && !isStaff) return null;

  // Ensure activeTab is valid for current role
  const validIds = tabs.map(t => t.id) as readonly string[];
  if (!validIds.includes(activeTab)) {
    setActiveTab("dashboard");
    return null;
  }


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto max-w-5xl flex items-center justify-between h-14 px-4">
          <h1 className="font-heading text-lg">Administrace</h1>
          <div className="flex items-center gap-2">
            <ViewAsSwitcher />
            <Button size="sm" variant="ghost" asChild>
              <a href="/"><Home className="w-4 h-4 mr-1" /> Web</a>
            </Button>
            <Button size="sm" variant="ghost" onClick={logout}>
              <LogOut className="w-4 h-4 mr-1" /> Odhlásit
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-5xl px-4 py-6">
        {isTeacher ? (
          <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-6 space-y-2">
            <div className="flex flex-wrap gap-1 border-b border-border">
              <button
                onClick={() => { setOpenGroupId(null); setCollapsed(true); setActiveTab("my-panel"); }}
                className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "my-panel" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserSquare2 className="w-4 h-4" /> Můj panel
              </button>
              <button
                onClick={() => { setOpenGroupId(null); setCollapsed(true); setActiveTab("staff-academy"); }}
                className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "staff-academy" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <BookOpen className="w-4 h-4" /> Interní akademie
              </button>



              {groups.map((g) => {
                const isOpen = currentGroup?.id === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleGroup(g.id)}
                    aria-expanded={isOpen}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      isOpen ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {g.label}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                  </button>
                );
              })}
              {usersTab && (
                <button
                  onClick={() => { setOpenGroupId(null); setCollapsed(true); setActiveTab("users"); }}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "users" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="w-4 h-4" /> Uživatelé
                </button>
              )}
              <button
                onClick={() => { setOpenGroupId(null); setCollapsed(true); setActiveTab("help"); }}
                className={`ml-auto flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "help" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <HelpCircle className="w-4 h-4" /> Nápověda
              </button>
            </div>
            {currentGroup && (
              <div className="flex flex-wrap gap-1.5">
                {currentGroup.items.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setCollapsed(false); setOpenGroupId(currentGroup.id); setActiveTab(tab.id as Tab); }}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}


        {activeTab === "dashboard" && <AdminDashboard onNavigate={(tab) => { setOpenGroupId(null); setCollapsed(false); setActiveTab(tab as Tab); }} isTeacher={isTeacher} />}
        {activeTab === "my-panel" && (
          <MyStaffPanel onNavigate={(tab) => { setOpenGroupId(null); setCollapsed(false); setActiveTab(tab as Tab); }} />
        )}


        {activeTab === "staff-academy" && !isTeacher && <StaffKnowledgeManager />}
        {activeTab === "stats" && !isTeacher && <SystemStats />}
        {activeTab === "textbooks" && isTeacher && <TeacherTextbooksManager />}
        {activeTab === "lessons" && isTeacher && <LessonsManager />}
        {activeTab === "outline" && isTeacher && <LessonOutlineGenerator />}
        {activeTab === "mcq" && isTeacher && <MCQGenerator />}
        {activeTab === "matching" && isTeacher && <MatchingGenerator />}
        {activeTab === "slide-edit" && isTeacher && <SlideEditor />}
        {activeTab === "video-ai" && isTeacher && <VideoCheckpointGenerator />}
        {activeTab === "subjects" && isTeacher && <SubjectsManager />}
        {activeTab === "users" && !isTeacher && <UsersManager />}
        {activeTab === "classes" && isTeacher && <ClassesManager />}
        {activeTab === "results" && isTeacher && <ClassResultsManager />}
        {activeTab === "notifications" && !isTeacher && <NotificationsManager />}
        {activeTab === "licenses" && !isTeacher && <SchoolLicensesManager />}
        {activeTab === "schools" && !isTeacher && <SchoolsManager />}
        {activeTab === "unassigned-teachers" && !isTeacher && <UnassignedTeachersManager />}
        {activeTab === "audit" && !isTeacher && <AuditLogViewer />}
        {activeTab === "templates" && !isTeacher && <TextbookTemplatesManager />}
        {activeTab === "landing" && !isTeacher && <LandingPageManager />}
        {activeTab === "avatars" && !isTeacher && <AvatarItemsManager />}
        {activeTab === "game-backgrounds" && !isTeacher && <GameBackgroundsManager />}
        {activeTab === "textbook-overview" && !isTeacher && <TextbookOverviewManager />}
        {activeTab === "academy" && !isTeacher && <AcademyCoursesManager />}
        {activeTab === "academy-pathways" && !isTeacher && <AcademyPathwaysManager />}
        {activeTab === "academy-evidence" && !isTeacher && <AcademyEvidenceReviewManager />}
        {activeTab === "crm" && !isTeacher && <CrmManager />}
        {activeTab === "market-economics" && !isTeacher && <MarketplaceEconomicsManager />}
        {activeTab === "website-assistant" && !isTeacher && <WebsiteAssistantManager />}
        {activeTab === "help" && (
          <div className="space-y-10">
            {!isTeacher && <AdminHelpManager />}
            <HelpGuidesManager />
          </div>
        )}

      </div>
    </div>
  );
};

const VIEW_AS_TARGETS: Record<string, string> = {
  school_admin: "/skola",
  teacher: "/ucitel",
  user: "/student",
};

const ViewAsSwitcher = () => {
  const { realRole, roles, viewAsRole, setViewAsRole } = useAuth();
  if (realRole !== "admin") return null;
  // Systémový admin má přístup ke školnímu pohledu vždy; roli school_admin jen
  // zvýrazníme. Dřívější tvrdá podmínka nabídku skrývala, když se seznam rolí
  // ještě nedonačetl (nebo se donačetl přes fallback), a možnost tak chyběla.
  const hasSchoolAdminRole = roles.includes("school_admin");
  const value = viewAsRole ?? "admin";
  return (

    <div className="flex items-center gap-1.5">
      <Eye className="w-4 h-4 text-muted-foreground" />
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === "admin") {
            setViewAsRole(null);
          } else {
            setViewAsRole(v as "school_admin" | "teacher" | "user");
            // Navigate to that role's dashboard so admin immediately sees it
            window.location.href = VIEW_AS_TARGETS[v] ?? "/";
          }
        }}
      >
        <SelectTrigger className="h-8 w-[190px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Admin (já)</SelectItem>
          {canSchoolAdmin && <SelectItem value="school_admin">Zobrazit jako admin školy</SelectItem>}
          <SelectItem value="teacher">Zobrazit jako učitel</SelectItem>
          <SelectItem value="user">Zobrazit jako žák</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default Admin;
