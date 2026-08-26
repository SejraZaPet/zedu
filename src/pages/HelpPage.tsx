import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  audience: string;
  cover_image_url: string | null;
}

const AUDIENCE_LABELS: Record<string, string> = {
  all: "Všichni",
  teacher: "Učitel",
  student: "Žák",
  parent: "Rodič",
};

const HelpPage = () => {
  const [guides, setGuides] = useState<HelpGuide[]>([]);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<"teacher" | "student">("student");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [audience, setAudience] = useState<string>("all-any");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .limit(1);
        const role = roles?.[0]?.role || "user";
        setUserRole(role);
        if (role === "teacher") setActiveRole("teacher");
        else setActiveRole("student");
      }

      const [{ data: guideData }, { data: articleData }] = await Promise.all([
        supabase
          .from("help_guides")
          .select("id, title, role, category, description, blocks")
          .eq("status", "published")
          .order("sort_order", { ascending: true }),
        supabase
          .from("help_articles")
          .select("id, title, slug, category, audience, cover_image_url")
          .eq("is_published", true)
          .order("category", { ascending: true })
          .order("sort_order", { ascending: true }),
      ]);
      if (guideData) setGuides(guideData.map(g => ({ ...g, blocks: (g.blocks || []) as unknown as Block[] })));
      if (articleData) setArticles(articleData as HelpArticle[]);
      setLoading(false);
    };
    init();
  }, []);

  const isAdmin = userRole === "admin";

  const filteredGuides = guides.filter(g => {
    if (g.role !== activeRole) return false;
    if (search && !g.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredArticles = articles.filter(a => {
    if (audience !== "all-any" && a.audience !== audience && a.audience !== "all") return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const articleCategories = [...new Set(filteredArticles.map(a => a.category).filter(Boolean))];
  const guideCategories = [...new Set(filteredGuides.map(g => g.category).filter(Boolean))];

  const showTeacherTab = isAdmin || userRole === "teacher";
  const showStudentTab = isAdmin || userRole === "user" || userRole === null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 pb-16" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
        <div className="container mx-auto max-w-4xl px-4">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-2">Nápověda</h1>
          <p className="text-muted-foreground mb-8">Návody a průvodci k používání systému Bezli</p>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Hledat v nápovědě…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all-any">Pro kohokoli</SelectItem>
                {Object.entries(AUDIENCE_LABELS).filter(([k]) => k !== "all").map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-muted-foreground">Načítání…</p>
          ) : (
            <div className="space-y-10">
              {/* Články nápovědy (markdown + screenshoty) */}
              {filteredArticles.length > 0 && (
                <div className="space-y-8">
                  {articleCategories.map(cat => (
                    <div key={cat}>
                      <h2 className="text-lg font-heading font-semibold mb-3 text-foreground">{cat}</h2>
                      <div className="grid gap-3">
                        {filteredArticles.filter(a => a.category === cat).map(a => (
                          <ItemCard
                            key={a.id}
                            title={a.title}
                            subtitle={AUDIENCE_LABELS[a.audience] || a.audience}
                            onClick={() => navigate(`/napoveda/${a.slug}`)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Interaktivní návody (blokové) */}
              {(showTeacherTab || showStudentTab) && guides.length > 0 && (
                <div>
                  <h2 className="text-lg font-heading font-semibold mb-3 text-foreground">Interaktivní návody</h2>
                  <div className="flex gap-3 mb-4">
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
                  {filteredGuides.length === 0 ? (
                    <p className="text-muted-foreground">Žádné návody pro tuto sekci.</p>
                  ) : (
                    <div className="space-y-6">
                      {guideCategories.map(cat => (
                        <div key={cat}>
                          <h3 className="font-medium mb-2 text-foreground">{cat}</h3>
                          <div className="grid gap-3">
                            {filteredGuides.filter(g => g.category === cat).map(guide => (
                              <ItemCard
                                key={guide.id}
                                title={guide.title}
                                subtitle={guide.description}
                                onClick={() => navigate(`/napoveda/pruvodce/${guide.id}`)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                      {filteredGuides.filter(g => !g.category).length > 0 && (
                        <div className="grid gap-3">
                          {filteredGuides.filter(g => !g.category).map(guide => (
                            <ItemCard
                              key={guide.id}
                              title={guide.title}
                              subtitle={guide.description}
                              onClick={() => navigate(`/napoveda/pruvodce/${guide.id}`)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {filteredArticles.length === 0 && filteredGuides.length === 0 && (
                <p className="text-muted-foreground">Žádné návody neodpovídají hledání.</p>
              )}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

const ItemCard = ({ title, subtitle, onClick }: { title: string; subtitle?: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all text-left w-full group"
  >
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
      <BookOpen className="w-5 h-5 text-primary" />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
    </div>
    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
  </button>
);

export default HelpPage;
