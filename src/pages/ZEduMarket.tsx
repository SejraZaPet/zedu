import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, BookOpen, FileText, LayoutTemplate, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listPublicShares,
  acceptShare,
  GRADE_LEVEL_OPTIONS,
  type PublicShareItem,
} from "@/lib/content-shares";
import { supabase } from "@/integrations/supabase/client";

const MATERIAL_MODES = [
  { value: "all", label: "Vše" },
  { value: "with", label: "S materiálem" },
  { value: "without", label: "Bez materiálu" },
  { value: "material_only", label: "Jen materiál" },
] as const;

export default function ZEduMarket() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<PublicShareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<{ slug: string; label: string }[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState<string>("all");
  const [grade, setGrade] = useState<string>("all");
  const [materialMode, setMaterialMode] = useState<
    "all" | "with" | "without" | "material_only"
  >("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("textbook_subjects")
        .select("slug,label")
        .order("label");
      setSubjects((data ?? []) as any);
    })();
  }, []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      try {
        const rows = await listPublicShares({
          search: search || undefined,
          subjects: subject !== "all" ? [subject] : undefined,
          grades: grade !== "all" ? [grade] : undefined,
          materialMode,
        });
        if (!cancel) setItems(rows);
      } catch (e: any) {
        if (!cancel)
          toast({
            title: "Načtení selhalo",
            description: e.message,
            variant: "destructive",
          });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [search, subject, grade, materialMode, toast]);

  async function handleAdd(item: PublicShareItem) {
    setAddingId(item.id);
    try {
      const { kind } = await acceptShare(item);
      toast({ title: "Přidáno do vašich materiálů" });
      if (kind === "textbook") navigate("/ucitel/ucebnice");
      else if (kind === "worksheet") navigate("/ucitel/pracovni-listy");
      else navigate("/ucitel/plany-hodin");
    } catch (e: any) {
      toast({
        title: "Přidání selhalo",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setAddingId(null);
    }
  }

  const subjectLabel = useMemo(() => {
    const m = new Map(subjects.map((s) => [s.slug, s.label]));
    return (slug?: string | null) => (slug ? m.get(slug) ?? slug : "—");
  }, [subjects]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <div aria-hidden className="h-[70px] shrink-0" />
      <main className="flex-1 container mx-auto px-4 pt-8 pb-12 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">ZEduMarket</h1>
          <p className="text-sm text-muted-foreground">
            Veřejná nabídka učebnic, pracovních listů a prezentací od učitelů.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_180px] mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Hledat podle názvu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger>
              <SelectValue placeholder="Předmět" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny předměty</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.slug} value={s.slug}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={grade} onValueChange={setGrade}>
            <SelectTrigger>
              <SelectValue placeholder="Stupeň" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny stupně</SelectItem>
              {GRADE_LEVEL_OPTIONS.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={materialMode}
            onValueChange={(v) => setMaterialMode(v as any)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Zatím žádné veřejné nabídky odpovídající filtrům.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => {
              const Icon =
                i.kind === "textbook"
                  ? BookOpen
                  : i.kind === "worksheet"
                  ? FileText
                  : LayoutTemplate;
              return (
                <div
                  key={i.id}
                  className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {i.kind === "textbook"
                        ? "Učebnice"
                        : i.kind === "worksheet"
                        ? "Pracovní list"
                        : "Prezentace"}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm line-clamp-2">
                    {i.target_title ?? "Bez názvu"}
                  </h3>
                  <div className="text-xs text-muted-foreground">
                    {subjectLabel(i.target_subject)} · {i.sharer_name ?? "Neznámý autor"}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(i.target_grade_level ?? []).map((g) => (
                      <Badge key={g} variant="secondary" className="text-[10px]">
                        {GRADE_LEVEL_OPTIONS.find((o) => o.value === g)?.label ?? g}
                      </Badge>
                    ))}
                    {i.kind === "textbook" && i.includes_worksheets && (
                      <Badge variant="outline" className="text-[10px]">
                        + pracovní listy
                      </Badge>
                    )}
                    {i.kind === "textbook" && i.includes_presentations && (
                      <Badge variant="outline" className="text-[10px]">
                        + prezentace
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="mt-auto"
                    onClick={() => handleAdd(i)}
                    disabled={addingId === i.id}
                  >
                    {addingId === i.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Přidat do mých materiálů
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
