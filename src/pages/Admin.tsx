import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import LessonOutlineGenerator from "@/components/admin/LessonOutlineGenerator";
import MCQGenerator from "@/components/admin/MCQGenerator";
import LessonsManager from "@/components/admin/LessonsManager";
import TextbooksManager from "@/components/admin/TextbooksManager";
import TeacherTextbooksManager from "@/components/admin/TeacherTextbooksManager";
import HelpGuidesManager from "@/components/admin/HelpGuidesManager";
import SubjectsManager from "@/components/admin/SubjectsManager";
import UsersManager from "@/components/admin/UsersManager";
import ClassesManager from "@/components/admin/ClassesManager";
import ClassResultsManager from "@/components/admin/ClassResultsManager";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { Button } from "@/components/ui/button";
import { BookOpen, LogOut, Home, GraduationCap, Settings, Users, School, BarChart3, LayoutDashboard, HelpCircle, ListTree } from "lucide-react";

const adminTabs = [
  { id: "dashboard", label: "Přehled", icon: LayoutDashboard },
  { id: "users", label: "Uživatelé", icon: Users },
  { id: "help", label: "Nápověda", icon: HelpCircle },
] as const;

const teacherTabs = [
  { id: "dashboard", label: "Přehled", icon: LayoutDashboard },
  { id: "textbooks", label: "Učebnice", icon: GraduationCap },
  { id: "lessons", label: "Lekce", icon: BookOpen },
  { id: "outline", label: "Osnova AI", icon: ListTree },
  { id: "subjects", label: "Předměty", icon: Settings },
  { id: "classes", label: "Třídy", icon: School },
  { id: "results", label: "Výsledky", icon: BarChart3 },
  { id: "help", label: "Nápověda", icon: HelpCircle },
] as const;

type Tab = "dashboard" | "textbooks" | "lessons" | "outline" | "subjects" | "users" | "classes" | "results" | "help";

const Admin = () => {
  const { isAdmin, isTeacher, loading, logout } = useAdmin();
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "dashboard";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const isAdminOnly = isAdmin && !isTeacher; // pure admin (not teacher)

  const tabs = useMemo(() => {
    if (isTeacher) return teacherTabs;
    return adminTabs;
  }, [isTeacher]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Ověřování přístupu...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

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

        {activeTab === "dashboard" && <AdminDashboard onNavigate={(tab) => setActiveTab(tab as Tab)} isTeacher={isTeacher} />}
        {activeTab === "textbooks" && isTeacher && <TeacherTextbooksManager />}
        {activeTab === "lessons" && isTeacher && <LessonsManager />}
        {activeTab === "outline" && isTeacher && <LessonOutlineGenerator />}
        {activeTab === "subjects" && isTeacher && <SubjectsManager />}
        {activeTab === "users" && !isTeacher && <UsersManager />}
        {activeTab === "classes" && isTeacher && <ClassesManager />}
        {activeTab === "results" && isTeacher && <ClassResultsManager />}
        {activeTab === "help" && <HelpGuidesManager />}
      </div>
    </div>
  );
};

export default Admin;
