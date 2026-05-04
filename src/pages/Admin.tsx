import { useState, useMemo } from "react";
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
import SubjectsManager from "@/components/admin/SubjectsManager";
import UsersManager from "@/components/admin/UsersManager";
import ClassesManager from "@/components/admin/ClassesManager";
import ClassResultsManager from "@/components/admin/ClassResultsManager";
import AdminDashboard from "@/components/admin/AdminDashboard";
import NotificationsManager from "@/components/admin/NotificationsManager";
import SchoolsManager from "@/components/admin/SchoolsManager";
import { Button } from "@/components/ui/button";
import { BookOpen, LogOut, Home, GraduationCap, Settings, Users, School, BarChart3, LayoutDashboard, HelpCircle, ListTree, CircleHelp, Link2, Pencil, Video, Bell } from "lucide-react";

const adminTabs = [
  { id: "dashboard", label: "Přehled", icon: LayoutDashboard },
  { id: "schools", label: "Školy", icon: School },
  { id: "users", label: "Uživatelé", icon: Users },
  { id: "notifications", label: "Notifikace", icon: Bell },
  { id: "help", label: "Nápověda", icon: HelpCircle },
] as const;

const teacherTabs = [
  { id: "dashboard", label: "Přehled", icon: LayoutDashboard },
  { id: "textbooks", label: "Učebnice", icon: GraduationCap },
  { id: "lessons", label: "Lekce", icon: BookOpen },
  { id: "outline", label: "Osnova AI", icon: ListTree },
  { id: "mcq", label: "MCQ AI", icon: CircleHelp },
  { id: "matching", label: "Matching AI", icon: Link2 },
  { id: "slide-edit", label: "Editor AI", icon: Pencil },
  { id: "video-ai", label: "Video AI", icon: Video },
  { id: "subjects", label: "Předměty", icon: Settings },
  { id: "classes", label: "Třídy", icon: School },
  { id: "results", label: "Výsledky", icon: BarChart3 },
  { id: "help", label: "Nápověda", icon: HelpCircle },
] as const;

type Tab = "dashboard" | "textbooks" | "lessons" | "outline" | "mcq" | "matching" | "slide-edit" | "video-ai" | "subjects" | "users" | "classes" | "results" | "help" | "notifications" | "schools";

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
        {activeTab === "mcq" && isTeacher && <MCQGenerator />}
        {activeTab === "matching" && isTeacher && <MatchingGenerator />}
        {activeTab === "slide-edit" && isTeacher && <SlideEditor />}
        {activeTab === "video-ai" && isTeacher && <VideoCheckpointGenerator />}
        {activeTab === "subjects" && isTeacher && <SubjectsManager />}
        {activeTab === "users" && !isTeacher && <UsersManager />}
        {activeTab === "classes" && isTeacher && <ClassesManager />}
        {activeTab === "results" && isTeacher && <ClassResultsManager />}
        {activeTab === "notifications" && !isTeacher && <NotificationsManager />}
        {activeTab === "schools" && !isTeacher && <SchoolsManager />}
        {activeTab === "help" && <HelpGuidesManager />}
      </div>
    </div>
  );
};

const ViewAsSwitcher = () => {
  const { realRole, viewAsRole, setViewAsRole } = useAuth();
  if (realRole !== "admin") return null;
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
            setViewAsRole(v as "teacher" | "user");
            // Navigate to that role's dashboard so admin immediately sees it
            window.location.href = v === "teacher" ? "/ucitel" : "/student";
          }
        }}
      >
        <SelectTrigger className="h-8 w-[150px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Admin (já)</SelectItem>
          <SelectItem value="teacher">Zobrazit jako učitel</SelectItem>
          <SelectItem value="user">Zobrazit jako žák</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default Admin;
