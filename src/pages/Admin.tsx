import { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
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
import { BookOpen, LogOut, Home, GraduationCap, Settings, Users, School, BarChart3, LayoutDashboard, HelpCircle } from "lucide-react";
import { useMemo } from "react";

const allTabs = [
  { id: "dashboard", label: "Přehled", icon: LayoutDashboard, adminOnly: false },
  { id: "textbooks", label: "Učebnice", icon: GraduationCap, adminOnly: false },
  { id: "lessons", label: "Lekce", icon: BookOpen, adminOnly: false },
  { id: "subjects", label: "Předměty", icon: Settings, adminOnly: false },
  { id: "users", label: "Uživatelé", icon: Users, adminOnly: true },
  { id: "classes", label: "Třídy", icon: School, adminOnly: false },
  { id: "results", label: "Výsledky", icon: BarChart3, adminOnly: false },
  { id: "help", label: "Nápověda", icon: HelpCircle, adminOnly: false },
] as const;

type Tab = typeof allTabs[number]["id"];

const Admin = () => {
  const { isAdmin, isTeacher, loading, logout } = useAdmin();
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  const tabs = useMemo(
    () => allTabs.filter((tab) => !tab.adminOnly || !isTeacher),
    [isTeacher]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Ověřování přístupu...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  // If teacher tries to access users tab directly, redirect to dashboard
  if (isTeacher && activeTab === "users") {
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
              onClick={() => setActiveTab(tab.id)}
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
        {activeTab === "textbooks" && (isTeacher ? <TeacherTextbooksManager /> : <TextbooksManager />)}
        {activeTab === "lessons" && <LessonsManager />}
        {activeTab === "subjects" && <SubjectsManager />}
        {!isTeacher && activeTab === "users" && <UsersManager />}
        {activeTab === "classes" && <ClassesManager />}
        {activeTab === "results" && <ClassResultsManager />}
        {activeTab === "help" && <HelpGuidesManager />}
      </div>
    </div>
  );
};

export default Admin;
