import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MultiSelectFilter from "@/components/sharing/MultiSelectFilter";
import { Loader2, Search, BookOpen, FileText, LayoutTemplate, Download, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PublicTextbookPreviewDialog from "@/components/sharing/PublicTextbookPreviewDialog";
import TextbookOutlinePreview from "@/components/sharing/TextbookOutlinePreview";
import TextbookTrialButton from "@/components/sharing/TextbookTrialButton";
import {
  listPublicShares,
  acceptShare,
  getReviewAggregates,
  getUsageCounts,
  GRADE_LEVEL_OPTIONS,
  LANGUAGE_OPTIONS,
  DIFFICULTY_OPTIONS,
  type PublicShareItem,
  type ReviewAggregate,
} from "@/lib/content-shares";

import ReviewSummary from "@/components/sharing/ReviewSummary";
import FollowCreatorButton from "@/components/sharing/FollowCreatorButton";
import { listFollowedCreatorIds } from "@/lib/creator-follows";
import { supabase } from "@/integrations/supabase/client";


const MATERIAL_MODES = [
  { value: "all", label: "Vše" },
  { value: "with", label: "S materiálem" },
  { value: "without", label: "Bez materiálu" },
  { value: "material_only", label: "Jen materiál" },
] as const;

export default function BezliMarketPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<PublicShareItem[]>([]);
  const [ratings, setRatings] = useState<Map<string, ReviewAggregate>>(new Map());
  const [usage, setUsage] = useState<Map<string, number>>(new Map());
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);


  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [previewTextbook, setPreviewTextbook] = useState<{ id: string; title: string } | null>(null);
  const [subjects, setSubjects] = useState<{ slug: string; label: string }[]>([]);
  const [search, setSearch] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
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
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUserId(session?.user.id ?? null);
      if (session) {
        try {
          const ids = await listFollowedCreatorIds();
          setFollowingIds(new Set(ids));
        } catch {
          /* ignore */
        }
      }
    })();
  }, []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      try {
        const rows = await listPublicShares({
          search: search || undefined,
          subjects: selectedSubjects.length > 0 ? selectedSubjects : undefined,
          grades: selectedGrades.length > 0 ? selectedGrades : undefined,
          languages: selectedLanguages.length > 0 ? selectedLanguages : undefined,
          difficulties: selectedDifficulties.length > 0 ? selectedDifficulties : undefined,
          materialMode,
        });

        if (!cancel) {
          setItems(rows);
          // Batch-load ratings per kind
          const tbIds = rows.filter((r) => r.kind === "textbook" && r.textbook_id).map((r) => r.textbook_id as string);
          const wsIds = rows.filter((r) => r.kind === "worksheet" && r.worksheet_id).map((r) => r.worksheet_id as string);
          const lpIds = rows.filter((r) => r.kind === "lesson_plan" && r.lesson_plan_id).map((r) => r.lesson_plan_id as string);
          try {
            const [tbMap, wsMap, lpMap, usageMap] = await Promise.all([
              getReviewAggregates("textbook", tbIds),
              getReviewAggregates("worksheet", wsIds),
              getReviewAggregates("lesson_plan", lpIds),
              getUsageCounts({ textbookIds: tbIds, worksheetIds: wsIds, lessonPlanIds: lpIds }),
            ]);
            if (cancel) return;
            const merged = new Map<string, ReviewAggregate>();
            for (const [k, v] of tbMap) merged.set(`textbook:${k}`, v);
            for (const [k, v] of wsMap) merged.set(`worksheet:${k}`, v);
            for (const [k, v] of lpMap) merged.set(`lesson_plan:${k}`, v);
            setRatings(merged);
            setUsage(usageMap);
          } catch {
            /* ignore */
          }
        }

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
  }, [search, selectedSubjects, selectedGrades, selectedLanguages, selectedDifficulties, materialMode, toast]);

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
          <h1 className="text-2xl font-bold">BezliMarket</h1>
          <p className="text-sm text-muted-foreground">
            Veřejná nabídka učebnic, pracovních listů a prezentací od učitelů.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Hledat podle názvu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <MultiSelectFilter
            label="Předmět"
            allLabel="všechny"
            values={selectedSubjects}
            options={subjects.map((s) => ({ value: s.slug, label: s.label }))}
            onChange={setSelectedSubjects}
          />
          <MultiSelectFilter
            label="Stupeň"
            allLabel="všechny"
            values={selectedGrades}
            options={GRADE_LEVEL_OPTIONS}
            onChange={setSelectedGrades}
          />
          <MultiSelectFilter
            label="Jazyk"
            allLabel="všechny"
            values={selectedLanguages}
            options={LANGUAGE_OPTIONS}
            onChange={setSelectedLanguages}
          />
          <MultiSelectFilter
            label="Obtížnost"
            allLabel="všechny"
            values={selectedDifficulties}
            options={DIFFICULTY_OPTIONS}
            onChange={setSelectedDifficulties}
          />
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
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>
                      {subjectLabel(i.target_subject)} · {i.sharer_name ?? "Neznámý autor"}
                    </span>
                    {i.shared_by && currentUserId && i.shared_by !== currentUserId && (
                      <FollowCreatorButton
                        creatorId={i.shared_by}
                        creatorName={i.sharer_name ?? undefined}
                        isFollowing={followingIds.has(i.shared_by)}
                        onChange={(now) => {
                          setFollowingIds((prev) => {
                            const next = new Set(prev);
                            if (now) next.add(i.shared_by);
                            else next.delete(i.shared_by);
                            return next;
                          });
                        }}
                      />
                    )}
                  </div>
                  {(() => {
                    const targetId =
                      i.kind === "textbook"
                        ? i.textbook_id
                        : i.kind === "worksheet"
                        ? i.worksheet_id
                        : i.lesson_plan_id;
                    if (!targetId) return null;
                    const agg = ratings.get(`${i.kind}:${targetId}`);
                    const count = usage.get(`${i.kind}:${targetId}`) ?? 0;
                    const hasRating = agg && agg.count > 0;
                    if (!hasRating && count === 0) {
                      return (
                        <div className="text-[11px] text-muted-foreground">
                          Zatím nikým nepoužito
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        {hasRating && (
                          <ReviewSummary
                            kind={i.kind}
                            targetId={targetId as string}
                            aggregate={agg}
                          />
                        )}
                        {count > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            Použito {count} {count === 1 ? "učitelem" : count >= 2 && count <= 4 ? "učiteli" : "učiteli"}
                          </Badge>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex flex-wrap gap-1">
                    {(i.target_grade_level ?? []).map((g) => (
                      <Badge key={g} variant="secondary" className="text-[10px]">
                        {GRADE_LEVEL_OPTIONS.find((o) => o.value === g)?.label ?? g}
                      </Badge>
                    ))}
                    {i.kind === "textbook" && i.target_language && i.target_language !== "cs" && (
                      <Badge variant="outline" className="text-[10px]">
                        {LANGUAGE_OPTIONS.find((o) => o.value === i.target_language)?.label ?? i.target_language}
                      </Badge>
                    )}
                    {i.kind === "textbook" && i.target_difficulty_level && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-primary/40 text-primary"
                      >
                        {DIFFICULTY_OPTIONS.find((o) => o.value === i.target_difficulty_level)?.label ?? i.target_difficulty_level}
                      </Badge>
                    )}
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

                  {i.kind === "textbook" && i.textbook_id && (
                    <TextbookOutlinePreview textbookId={i.textbook_id as string} />
                  )}
                  <div className="mt-auto flex flex-col gap-2">
                    {i.kind === "textbook" && i.textbook_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setPreviewTextbook({
                            id: i.textbook_id as string,
                            title: i.target_title ?? "Učebnice",
                          })
                        }
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Náhled první lekce zdarma
                      </Button>
                    )}
                    {i.kind === "textbook" && i.textbook_id && (
                      <TextbookTrialButton
                        textbookId={i.textbook_id as string}
                        textbookTitle={i.target_title ?? "Učebnice"}
                      />
                    )}
                    <Button
                      size="sm"
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
                </div>
              );
            })}
          </div>
        )}
      </main>
      <PublicTextbookPreviewDialog
        open={!!previewTextbook}
        onOpenChange={(o) => !o && setPreviewTextbook(null)}
        textbookId={previewTextbook?.id ?? null}
        textbookTitle={previewTextbook?.title ?? ""}
      />
      <SiteFooter />
    </div>
  );
}
