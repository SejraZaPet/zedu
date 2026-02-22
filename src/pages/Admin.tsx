import { useState } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import LessonsManager from "@/components/admin/LessonsManager";
import ArticlesManager from "@/components/admin/ArticlesManager";
import LinksManager from "@/components/admin/LinksManager";
import { Button } from "@/components/ui/button";
import { BookOpen, FileText, Link2, LogOut, Home } from "lucide-react";

const tabs = [
  { id: "lessons", label: "Lekce", icon: BookOpen },
  { id: "articles", label: "Články", icon: FileText },
  { id: "links", label: "Odkazy", icon: Link2 },
] as const;

type Tab = typeof tabs[number]["id"];

const Admin = () => {
  const { isAdmin, loading, logout } = useAdmin();
  const [activeTab, setActiveTab] = useState<Tab>("lessons");

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Ověřování přístupu...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
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

        {/* Content */}
        {activeTab === "lessons" && <LessonsManager />}
        {activeTab === "articles" && <ArticlesManager />}
        {activeTab === "links" && <LinksManager />}
      </div>
    </div>
  );
};

export default Admin;
