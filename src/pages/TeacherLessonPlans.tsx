import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Plus, Search } from "lucide-react";

export default function TeacherLessonPlans() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  // Zatím bez DB – prázdný seznam
  const items: { id: string; title: string; description: string }[] = [];

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q),
    );
  }, [items, search]);

  function handleCreate() {
    // TODO: napojit na DB
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <div aria-hidden className="h-[70px] shrink-0" />

      <main className="flex-1 container mx-auto px-4 pt-8 pb-12 max-w-4xl">
        {/* Hlavička */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Plány hodin</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Organizuj lekce a pracovní listy do tematických plánů.
            </p>
          </div>
          <Button onClick={handleCreate} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Nový plán
          </Button>
        </div>

        {/* Vyhledávání */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Hledat plán…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Obsah */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {search.trim()
                ? "Žádný plán neodpovídá hledání."
                : "Zatím nemáš žádné plány hodin. Vytvoř první!"}
            </p>
            {!search.trim() && (
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Nový plán
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((plan) => (
              <div
                key={plan.id}
                className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2 hover:border-primary/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm truncate">{plan.title}</span>
                </div>
                {plan.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {plan.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
