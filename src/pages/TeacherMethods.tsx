import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Lightbulb, Search, Sparkles, BarChart3, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type LearningMethod = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  time_range: string | null;
  tips: string | null;
};

type Usage = {
  method_id: string;
  created_at: string; // lesson_plan.created_at
};

const CATEGORY_LABELS: Record<string, string> = {
  aktivizacni: "Aktivizační",
  kooperativni: "Kooperativní",
  kriticke_mysleni: "Kritické myšlení",
  prezentacni: "Prezentační",
  reflexni: "Reflexní",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  snadna: "Snadná",
  stredni: "Střední",
  pokrocila: "Pokročilá",
};

export default function TeacherMethods() {
  const { user } = useAuth();
  const [methods, setMethods] = useState<LearningMethod[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("learning_methods")
      .select("id,name,slug,description,category,difficulty,time_range,tips")
      .order("name", { ascending: true })
      .then(({ data }) => setMethods((data as any[]) ?? []));
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Get teacher's plans, then their method links
      const { data: plans } = await supabase
        .from("lesson_plans")
        .select("id, created_at")
        .eq("teacher_id", user.id);
      const planIds = (plans ?? []).map((p: any) => p.id);
      if (!planIds.length) {
        setUsage([]);
        return;
      }
      const planMap = new Map<string, string>(
        (plans as any[]).map((p) => [p.id, p.created_at]),
      );
      const { data: links } = await supabase
        .from("lesson_method_links")
        .select("method_id, lesson_plan_id")
        .in("lesson_plan_id", planIds);
      const rows: Usage[] = (links ?? []).map((l: any) => ({
        method_id: l.method_id,
        created_at: planMap.get(l.lesson_plan_id) || new Date().toISOString(),
      }));
      setUsage(rows);
    })();
  }, [user]);

  const filteredMethods = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return methods;
    return methods.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.description ?? "").toLowerCase().includes(q) ||
        (CATEGORY_LABELS[m.category ?? ""] ?? "").toLowerCase().includes(q),
    );
  }, [methods, search]);

  // Statistics
  const usageByMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of usage) map.set(u.method_id, (map.get(u.method_id) ?? 0) + 1);
    return map;
  }, [usage]);

  const chartData = useMemo(() => {
    return methods
      .map((m) => ({ name: m.name, count: usageByMethod.get(m.id) ?? 0 }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [methods, usageByMethod]);

  // Last month / last 6 months counts
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const semesterAgo = new Date(now.getTime() - 182 * 24 * 3600 * 1000);
  const usedLastMonth = usage.filter((u) => new Date(u.created_at) >= monthAgo).length;
  const usedLastSemester = usage.filter((u) => new Date(u.created_at) >= semesterAgo).length;
  const totalUsage = usage.length;
  const uniqueMethodsUsed = usageByMethod.size;

  // Recommendations: methods never tried, prioritise diverse categories not covered
  const usedCategories = new Set(
    Array.from(usageByMethod.keys())
      .map((id) => methods.find((m) => m.id === id)?.category)
      .filter(Boolean) as string[],
  );
  const recommendations = useMemo(() => {
    const untried = methods.filter((m) => !usageByMethod.has(m.id));
    // Sort: methods from categories not yet used first
    return untried
      .sort((a, b) => {
        const aNew = !usedCategories.has(a.category ?? "") ? -1 : 0;
        const bNew = !usedCategories.has(b.category ?? "") ? -1 : 0;
        return aNew - bNew;
      })
      .slice(0, 6);
  }, [methods, usageByMethod, usedCategories]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <div aria-hidden className="h-[70px] shrink-0" />
      <main className="flex-1 container mx-auto px-4 pt-8 pb-12 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-primary" />
            Výukové metody
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Katalog moderních pedagogických metod a vaše statistiky využití.
          </p>
        </div>

        <Tabs defaultValue="catalog" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="catalog">
              <BookOpen className="w-4 h-4 mr-1.5" />
              Katalog ({methods.length})
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="w-4 h-4 mr-1.5" />
              Moje statistiky
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="space-y-4">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hledat metodu…"
                className="pl-9"
              />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMethods.map((m) => (
                <article
                  key={m.id}
                  className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2"
                >
                  <header>
                    <h3 className="font-semibold">{m.name}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {m.category && (
                        <Badge variant="secondary" className="text-[10px]">
                          {CATEGORY_LABELS[m.category] ?? m.category}
                        </Badge>
                      )}
                      {m.difficulty && (
                        <Badge variant="outline" className="text-[10px]">
                          {DIFFICULTY_LABELS[m.difficulty] ?? m.difficulty}
                        </Badge>
                      )}
                      {m.time_range && (
                        <Badge variant="outline" className="text-[10px]">
                          {m.time_range}
                        </Badge>
                      )}
                    </div>
                  </header>
                  {m.description && (
                    <p className="text-sm text-muted-foreground line-clamp-4">{m.description}</p>
                  )}
                </article>
              ))}
              {filteredMethods.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full text-center py-8">
                  Žádné metody neodpovídají hledání.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            {/* Summary tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile label="Celkem použití" value={totalUsage} />
              <StatTile label="Různých metod" value={`${uniqueMethodsUsed} / ${methods.length}`} />
              <StatTile label="Posledních 30 dnů" value={usedLastMonth} />
              <StatTile label="Posledních 6 měsíců" value={usedLastSemester} />
            </div>

            {/* Chart */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Nejčastěji používané metody
              </h2>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Zatím jste v plánech hodin nepoužil/a žádnou metodu z katalogu.
                </p>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 50 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="name"
                        angle={-30}
                        textAnchor="end"
                        height={70}
                        interval={0}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Recommendations */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold mb-1 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Doporučujeme vyzkoušet
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Metody, které jste zatím nepoužil/a — prioritu mají kategorie, které ve vašich
                plánech zatím chybí.
              </p>
              {recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Vyzkoušel/a jste už všechny metody z katalogu — výborně!
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recommendations.map((m) => {
                    const newCategory = !usedCategories.has(m.category ?? "");
                    return (
                      <div
                        key={m.id}
                        className="border border-border rounded-lg p-3 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-sm">{m.name}</h3>
                          {newCategory && m.category && (
                            <Badge className="text-[10px] shrink-0">Nová oblast</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {m.category && (
                            <Badge variant="secondary" className="text-[10px]">
                              {CATEGORY_LABELS[m.category] ?? m.category}
                            </Badge>
                          )}
                          {m.difficulty && (
                            <Badge variant="outline" className="text-[10px]">
                              {DIFFICULTY_LABELS[m.difficulty] ?? m.difficulty}
                            </Badge>
                          )}
                        </div>
                        {m.description && (
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {m.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <SiteFooter />
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );
}
