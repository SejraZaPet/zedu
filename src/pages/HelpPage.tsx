import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Input } from "@/components/ui/input";
import { Search, GraduationCap, BookOpen, ArrowRight } from "lucide-react";
import type { Block } from "@/lib/textbook-config";

interface HelpGuide {
  id: string;
  title: string;
  role: string;
  category: string;
  description: string;
  blocks: Block[];
}

const HelpPage = () => {
  const [guides, setGuides] = useState<HelpGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<"teacher" | "student">("student");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      // Detect user role
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .limit(1);
        const role = roles?.[0]?.role || "user";
        setUserRole(role);
        // Set default tab based on role
        if (role === "teacher") setActiveRole("teacher");
        else setActiveRole("student");
      }

      // Fetch guides
      const { data } = await supabase
        .from("help_guides")
        .select("id, title, role, category, description, blocks")
        .eq("status", "published")
        .order("sort_order", { ascending: true });
      if (data) setGuides(data.map(g => ({ ...g, blocks: (g.blocks || []) as unknown as Block[] })));
      setLoading(false);
    };
    init();
  }, []);

  const isAdmin = userRole === "admin";

  const filtered = guides.filter(g => {
    if (!isAdmin && g.role !== activeRole) return false;
    if (isAdmin && g.role !== activeRole) return false;
    if (search && !g.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const categories = [...new Set(filtered.map(g => g.category).filter(Boolean))];

  // Non-admin non-teacher users (students) shouldn't see teacher tab, and vice versa
  // But admin sees both tabs
  const showTeacherTab = isAdmin || userRole === "teacher";
  const showStudentTab = isAdmin || userRole === "user" || userRole === null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 pb-16" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
        <div className="container mx-auto max-w-4xl px-4">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-2">Nápověda</h1>
          <p className="text-muted-foreground mb-8">Návody k používání systému ZEdu</p>

          {/* Role tabs - show both for admin, otherwise show relevant one(s) */}
          {(showTeacherTab || showStudentTab) && (
            <div className="flex gap-3 mb-6">
              {showTeacherTab && (
                <button
                  onClick={() => setActiveRole("teacher")}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl border-2 transition-all font-medium ${
                    activeRole === "teacher"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <GraduationCap className="w-5 h-5" />
                  Jsem učitel
                </button>
              )}
              {showStudentTab && (
                <button
                  onClick={() => setActiveRole("student")}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl border-2 transition-all font-medium ${
                    activeRole === "student"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <BookOpen className="w-5 h-5" />
                  Jsem žák
                </button>
              )}
            </div>
          )}

          {/* Search */}
          <div className="relative mb-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Hledat v nápovědě…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <p className="text-muted-foreground">Načítání…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground">Žádné návody pro tuto sekci.</p>
          ) : (
            <div className="space-y-8">
              {categories.length > 0 &&
                categories.map(cat => (
                  <div key={cat}>
                    <h2 className="text-lg font-heading font-semibold mb-3 text-foreground">{cat}</h2>
                    <div className="grid gap-3">
                      {filtered.filter(g => g.category === cat).map(guide => (
                        <GuideCard key={guide.id} guide={guide} onClick={() => navigate(`/napoveda/${guide.id}`)} />
                      ))}
                    </div>
                  </div>
                ))
              }
              {filtered.filter(g => !g.category).length > 0 && (
                <div className="grid gap-3">
                  {filtered.filter(g => !g.category).map(guide => (
                    <GuideCard key={guide.id} guide={guide} onClick={() => navigate(`/napoveda/${guide.id}`)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

const GuideCard = ({ guide, onClick }: { guide: HelpGuide; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all text-left w-full group"
  >
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
      <BookOpen className="w-5 h-5 text-primary" />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">{guide.title}</h3>
      {guide.description && <p className="text-sm text-muted-foreground truncate">{guide.description}</p>}
    </div>
    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
  </button>
);

export default HelpPage;
