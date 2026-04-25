import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronLeft,
  ChevronDown,
  GripVertical,
  Trash2,
  Plus,
  Eye,
  Loader2,
  CheckCircle2,
  Send,
  X,
  RotateCcw,
  Sparkles,
  BookOpen,
  Wand2,
  FileDown,
  LayoutTemplate,
  Printer,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  WorksheetSpec,
  WorksheetItem,
  ItemType,
  Difficulty,
  AnswerKeyEntry,
  OfflineMode,
  GroupSize,
} from "@/lib/worksheet-spec";
import {
  emptyWorksheetSpec,
  createDefaultItem,
  createDefaultAnswerKey,
  recomputeMetadata,
  ITEM_TYPE_LABELS,
  OFFLINE_MODE_LABELS,
  GROUP_SIZE_LABELS,
} from "@/lib/worksheet-defaults";
import { OFFLINE_MODE_META } from "@/lib/worksheet-offline-meta";
import { splitLessonContent, type LessonBlock } from "@/lib/lesson-content-splitter";
import WorksheetPlayer from "@/components/WorksheetPlayer";

type SaveState = "idle" | "saving" | "saved" | "error";

const ITEM_TYPES: ItemType[] = [
  "mcq",
  "true_false",
  "fill_blank",
  "matching",
  "ordering",
  "short_answer",
  "open_answer",
];

const OFFLINE_MODES: OfflineMode[] = [
  "discussion",
  "group_work",
  "practical",
  "observation",
  "reflection",
];

const MODE_OPTIONS = [
  { value: "classwork", label: "Práce v hodině" },
  { value: "homework", label: "Domácí úkol" },
  { value: "test", label: "Test" },
  { value: "revision", label: "Opakování" },
];

const HISTORY_LIMIT = 50;

interface AiSuggestion {
  type: ItemType;
  difficulty: Difficulty;
  points: number;
  prompt: string;
  rationale: string;
  choices?: string[];
  correctChoice?: string;
  correctBoolean?: boolean;
  blankText?: string;
  blankAnswers?: string[];
  matchPairs?: Array<{ left: string; right: string }>;
  orderItems?: string[];
  shortAnswer?: string;
  rubric?: string;
  offlineMode?: OfflineMode;
  groupSize?: GroupSize;
  durationMin?: number;
}

export default function WorksheetEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [spec, setSpec] = useState<WorksheetSpec | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [previewOpen, setPreviewOpen] = useState(false);

  const [sourceLessonId, setSourceLessonId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [allLessons, setAllLessons] = useState<Array<{ id: string; title: string }>>([]);
  const [activeLessonContent, setActiveLessonContent] = useState<string>("");

  const [suggestionDialog, setSuggestionDialog] = useState<{
    open: boolean;
    blockText: string;
    blockTitle: string;
    loading: boolean;
    suggestions: AiSuggestion[];
    customInstruction: string;
  }>({
    open: false,
    blockText: "",
    blockTitle: "",
    loading: false,
    suggestions: [],
    customInstruction: "",
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoad = useRef(true);
  const historyRef = useRef<WorksheetSpec[]>([]);
  const skipNextHistoryPush = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Načtení worksheetu ──
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!id) return;

    (async () => {
      const { data, error } = await supabase
        .from("worksheets" as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        toast({ title: "Nepodařilo se načíst", description: error?.message, variant: "destructive" });
        navigate("/ucitel/pracovni-listy");
        return;
      }
      const row = data as any;
      let loaded: WorksheetSpec = row.spec && row.spec.version ? row.spec : emptyWorksheetSpec({
        title: row.title,
        subject: row.subject,
        gradeBand: row.grade_band,
        worksheetMode: row.worksheet_mode,
      });
      loaded = {
        ...loaded,
        header: {
          ...loaded.header,
          title: row.title,
          subject: row.subject,
          gradeBand: row.grade_band,
          worksheetMode: row.worksheet_mode,
        },
      };
      setSpec(loaded);
      setStatus(row.status);
      setSourceLessonId(row.source_lesson_id ?? null);
      setActiveLessonId(row.source_lesson_id ?? null);
      setLoading(false);
      initialLoad.current = false;
    })();
  }, [authLoading, user, id, navigate]);

  // ── Načtení seznamu lekcí (pro Combobox) ──
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("lessons")
        .select("id, title")
        .order("title", { ascending: true })
        .limit(200);
      setAllLessons((data as any) ?? []);
    })();
  }, [user]);

  // ── Načtení obsahu vybrané lekce ──
  useEffect(() => {
    if (!activeLessonId) {
      setActiveLessonContent("");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("lessons")
        .select("content, title")
        .eq("id", activeLessonId)
        .maybeSingle();
      setActiveLessonContent((data as any)?.content ?? "");
    })();
  }, [activeLessonId]);

  // ── Auto-save ──
  useEffect(() => {
    if (loading || !spec || !id) return;
    if (initialLoad.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("worksheets" as any)
        .update({
          title: spec.header.title,
          subject: spec.header.subject,
          grade_band: spec.header.gradeBand,
          worksheet_mode: spec.header.worksheetMode,
          spec: spec as any,
        } as any)
        .eq("id", id);
      if (error) {
        setSaveState("error");
        toast({ title: "Ukládání selhalo", description: error.message, variant: "destructive" });
      } else {
        setSaveState("saved");
      }
    }, 1000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [spec, id, loading]);

  // ── Spec mutator (s history push) ──
  const updateSpec = useCallback((mutator: (s: WorksheetSpec) => WorksheetSpec) => {
    setSpec((prev) => {
      if (!prev) return prev;
      initialLoad.current = false;
      if (!skipNextHistoryPush.current) {
        // push current state to history before mutating
        historyRef.current.push(prev);
        if (historyRef.current.length > HISTORY_LIMIT) {
          historyRef.current.shift();
        }
      }
      skipNextHistoryPush.current = false;
      return recomputeMetadata(mutator(prev));
    });
  }, []);

  const undo = useCallback(() => {
    const previous = historyRef.current.pop();
    if (!previous) {
      toast({ title: "Není co vrátit zpět" });
      return;
    }
    skipNextHistoryPush.current = true;
    setSpec(previous);
    toast({ title: "Vráceno zpět" });
  }, []);

  // ── Ctrl+Z handler ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        // Don't hijack inside text inputs unless empty selection — keep simple: always intercept
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
          // Let native undo happen inside text fields
          return;
        }
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const items = spec?.variants[0]?.items ?? [];
  const answerKeys = spec?.answerKeys[spec.variants[0]?.variantId ?? "A"] ?? [];
  const selectedItem = items.find((it) => it.id === selectedId) ?? null;
  const selectedAnswer = answerKeys.find((a) => a.itemId === selectedId) ?? null;

  function addItem(type: ItemType) {
    if (!spec) return;
    const variantId = spec.variants[0].variantId;
    const newItem = createDefaultItem(type, items.length + 1);
    const newKey = createDefaultAnswerKey(newItem);
    updateSpec((s) => ({
      ...s,
      variants: s.variants.map((v, idx) =>
        idx === 0 ? { ...v, items: [...v.items, newItem] } : v
      ),
      answerKeys: {
        ...s.answerKeys,
        [variantId]: [...(s.answerKeys[variantId] ?? []), newKey],
      },
    }));
    setSelectedId(newItem.id);
  }

  function addOfflineActivity(mode: OfflineMode) {
    if (!spec) return;
    const variantId = spec.variants[0].variantId;
    const meta = OFFLINE_MODE_META[mode];
    const base = createDefaultItem("offline_activity", items.length + 1);
    const newItem: WorksheetItem = {
      ...base,
      offlineMode: mode,
      groupSize: meta.defaultGroup,
      durationMin: meta.defaultDuration,
      timeEstimateSec: meta.defaultDuration * 60,
      prompt: meta.defaultPrompt,
    };
    const newKey = createDefaultAnswerKey(newItem);
    updateSpec((s) => ({
      ...s,
      variants: s.variants.map((v, idx) =>
        idx === 0 ? { ...v, items: [...v.items, newItem] } : v
      ),
      answerKeys: {
        ...s.answerKeys,
        [variantId]: [...(s.answerKeys[variantId] ?? []), newKey],
      },
    }));
    setSelectedId(newItem.id);
  }

  function deleteItem(itemId: string) {
    if (!spec) return;
    const variantId = spec.variants[0].variantId;
    updateSpec((s) => ({
      ...s,
      variants: s.variants.map((v, idx) =>
        idx === 0 ? { ...v, items: v.items.filter((it) => it.id !== itemId) } : v
      ),
      answerKeys: {
        ...s.answerKeys,
        [variantId]: (s.answerKeys[variantId] ?? []).filter((a) => a.itemId !== itemId),
      },
    }));
    if (selectedId === itemId) setSelectedId(null);
  }

  function updateItem(itemId: string, patch: Partial<WorksheetItem>) {
    if (!spec) return;
    updateSpec((s) => ({
      ...s,
      variants: s.variants.map((v, idx) =>
        idx === 0
          ? {
              ...v,
              items: v.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
            }
          : v
      ),
    }));
  }

  function updateAnswerKey(itemId: string, patch: Partial<AnswerKeyEntry>) {
    if (!spec) return;
    const variantId = spec.variants[0].variantId;
    updateSpec((s) => ({
      ...s,
      answerKeys: {
        ...s.answerKeys,
        [variantId]: (s.answerKeys[variantId] ?? []).map((a) =>
          a.itemId === itemId ? { ...a, ...patch } : a
        ),
      },
    }));
  }

  /** Replace whole item (used by AI refine). */
  function replaceItem(itemId: string, newItem: WorksheetItem) {
    if (!spec) return;
    updateSpec((s) => ({
      ...s,
      variants: s.variants.map((v, idx) =>
        idx === 0
          ? { ...v, items: v.items.map((it) => (it.id === itemId ? newItem : it)) }
          : v
      ),
    }));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id || !spec) return;
    const oldIdx = items.findIndex((it) => it.id === active.id);
    const newIdx = items.findIndex((it) => it.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(items, oldIdx, newIdx);
    updateSpec((s) => ({
      ...s,
      variants: s.variants.map((v, idx) => (idx === 0 ? { ...v, items: reordered } : v)),
    }));
  }

  async function togglePublish() {
    if (!id) return;
    const next = status === "published" ? "draft" : "published";
    const { error } = await supabase
      .from("worksheets" as any)
      .update({ status: next } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Změna stavu selhala", description: error.message, variant: "destructive" });
    } else {
      setStatus(next);
      toast({ title: next === "published" ? "Publikováno" : "Vráceno do konceptu" });
    }
  }

  // ── AI: load suggestions for a lesson block ──
  async function openSuggestionsForBlock(block: LessonBlock) {
    setSuggestionDialog({
      open: true,
      blockText: block.text,
      blockTitle: block.title,
      loading: true,
      suggestions: [],
      customInstruction: "",
    });
    await fetchSuggestions(block.text, "");
  }

  async function fetchSuggestions(blockText: string, customInstruction: string) {
    setSuggestionDialog((d) => ({ ...d, loading: true, suggestions: [] }));
    try {
      const lesson = allLessons.find((l) => l.id === activeLessonId);
      const { data, error } = await supabase.functions.invoke("generate-block-suggestions", {
        body: {
          blockText,
          lessonTitle: lesson?.title ?? "",
          lessonSubject: spec?.header.subject ?? "",
          userInstruction: customInstruction,
        },
      });
      if (error) throw error;
      const list: AiSuggestion[] = (data as any)?.suggestions ?? [];
      setSuggestionDialog((d) => ({ ...d, loading: false, suggestions: list }));
    } catch (err: any) {
      setSuggestionDialog((d) => ({ ...d, loading: false }));
      toast({
        title: "AI návrhy selhaly",
        description: err?.message ?? "Zkuste to znovu",
        variant: "destructive",
      });
    }
  }

  function applySuggestion(s: AiSuggestion) {
    if (!spec) return;
    const variantId = spec.variants[0].variantId;
    const base = createDefaultItem(s.type, items.length + 1);
    const newItem: WorksheetItem = {
      ...base,
      prompt: s.prompt,
      points: s.points || base.points,
      difficulty: s.difficulty,
      ...(s.choices ? { choices: s.choices } : {}),
      ...(s.matchPairs ? { matchPairs: s.matchPairs } : {}),
      ...(s.orderItems ? { orderItems: s.orderItems } : {}),
      ...(s.blankText ? { blankText: s.blankText } : {}),
      ...(s.offlineMode ? { offlineMode: s.offlineMode } : {}),
      ...(s.groupSize ? { groupSize: s.groupSize } : {}),
      ...(s.durationMin
        ? { durationMin: s.durationMin, timeEstimateSec: s.durationMin * 60 }
        : {}),
    };
    let correct: string | string[] = "";
    if (s.type === "mcq") correct = s.correctChoice ?? s.choices?.[0] ?? "";
    else if (s.type === "true_false") correct = s.correctBoolean ? "true" : "false";
    else if (s.type === "fill_blank") correct = s.blankAnswers ?? "";
    else if (s.type === "matching") correct = (s.matchPairs ?? []).map((p) => `${p.left}=${p.right}`);
    else if (s.type === "ordering") correct = s.orderItems ?? [];
    else if (s.type === "short_answer") correct = s.shortAnswer ?? "";
    const newKey: AnswerKeyEntry = {
      itemId: newItem.id,
      itemNumber: newItem.itemNumber,
      correctAnswer: correct,
      ...(s.rubric ? { rubric: s.rubric } : {}),
    };
    updateSpec((sp) => ({
      ...sp,
      variants: sp.variants.map((v, idx) =>
        idx === 0 ? { ...v, items: [...v.items, newItem] } : v
      ),
      answerKeys: {
        ...sp.answerKeys,
        [variantId]: [...(sp.answerKeys[variantId] ?? []), newKey],
      },
    }));
    setSelectedId(newItem.id);
    setSuggestionDialog((d) => ({ ...d, open: false }));
    toast({ title: "Blok přidán do listu" });
  }

  // ── Update sourceLessonId v DB když si učitel přepne ──
  async function handleSetSourceLesson(lessonId: string | null) {
    setActiveLessonId(lessonId);
    // Update DB only if changed from current source
    if (lessonId !== sourceLessonId && id) {
      await supabase
        .from("worksheets" as any)
        .update({ source_lesson_id: lessonId } as any)
        .eq("id", id);
      setSourceLessonId(lessonId);
    }
  }

  if (loading || !spec) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="pt-32 text-center text-muted-foreground">Načítání…</div>
      </div>
    );
  }

  const lessonBlocks = splitLessonContent(activeLessonContent);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      {/* Sticky toolbar */}
      <div
        className="sticky z-30 bg-background/95 backdrop-blur border-b border-border"
        style={{ top: "70px" }}
      >
        <div className="container mx-auto px-4 py-3 flex items-center gap-3 max-w-7xl">
          <Button variant="ghost" size="sm" onClick={() => navigate("/ucitel/pracovni-listy")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Zpět
          </Button>
          <Input
            value={spec.header.title}
            onChange={(e) =>
              updateSpec((s) => ({ ...s, header: { ...s.header, title: e.target.value } }))
            }
            className="font-heading text-base font-semibold border-0 shadow-none focus-visible:ring-1 max-w-md"
          />
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={undo}
              title="Zpět (Ctrl+Z)"
              disabled={historyRef.current.length === 0}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <SaveIndicator state={saveState} />
            <Badge variant={status === "published" ? "default" : "secondary"}>
              {status === "published" ? "Publikováno" : "Koncept"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
              <Eye className="w-4 h-4 mr-1" /> Náhled
            </Button>
            <Button size="sm" onClick={togglePublish}>
              <Send className="w-4 h-4 mr-1" />
              {status === "published" ? "Vrátit do konceptu" : "Publikovat"}
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid gap-4 lg:grid-cols-[260px_1fr_340px]">
          {/* ── PALETA ── */}
          <aside className="bg-card border border-border rounded-xl p-4 lg:sticky lg:top-[140px] lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
            <h3 className="font-heading text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Otázky
            </h3>
            <div className="space-y-1.5">
              {ITEM_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => addItem(type)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors border border-transparent hover:border-border"
                >
                  <div className="text-sm font-medium">{ITEM_TYPE_LABELS[type].label}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {ITEM_TYPE_LABELS[type].description}
                  </div>
                </button>
              ))}
            </div>

            {/* Offline aktivity sekce */}
            <div className="mt-5 pt-4 border-t border-border">
              <h3 className="font-heading text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                Offline aktivity
              </h3>
              <div className="space-y-1.5">
                {OFFLINE_MODES.map((mode) => {
                  const meta = OFFLINE_MODE_META[mode];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={mode}
                      onClick={() => addOfflineActivity(mode)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent/10 transition-colors border border-transparent hover:border-accent/40 flex items-start gap-2"
                    >
                      <Icon className="w-4 h-4 mt-0.5 text-accent shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{meta.label}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {meta.defaultDuration} min · {GROUP_SIZE_LABELS[meta.defaultGroup]}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Z lekce sekce */}
            <div className="mt-5 pt-4 border-t border-border">
              <h3 className="font-heading text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Z lekce
              </h3>
              <Select
                value={activeLessonId ?? "__none__"}
                onValueChange={(v) => handleSetSourceLesson(v === "__none__" ? null : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Vyber lekci…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Žádná —</SelectItem>
                  {allLessons.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeLessonId && lessonBlocks.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">Lekce nemá obsah.</p>
              )}

              {lessonBlocks.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {lessonBlocks.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => openSuggestionsForBlock(b)}
                      className="w-full text-left px-2.5 py-2 rounded-md border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition text-xs"
                      title="Klik → AI navrhne 3 úlohy"
                    >
                      <div className="flex items-start gap-1.5">
                        <Sparkles className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                        <span className="line-clamp-2">{b.title}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground">
              <p className="mb-1">{items.length} otázek</p>
              <p className="mb-1">{spec.metadata.totalPoints} bodů</p>
              <p>~{spec.metadata.totalTimeMin} min</p>
            </div>
          </aside>

          {/* ── CANVAS ── */}
          <section className="bg-card border border-border rounded-xl p-6">
            {/* Hlavička pracovního listu */}
            <div className="grid sm:grid-cols-2 gap-3 mb-6 pb-6 border-b border-border">
              <div>
                <Label className="text-xs">Předmět</Label>
                <Input
                  value={spec.header.subject}
                  onChange={(e) =>
                    updateSpec((s) => ({ ...s, header: { ...s.header, subject: e.target.value } }))
                  }
                  placeholder="např. Matematika"
                />
              </div>
              <div>
                <Label className="text-xs">Ročník</Label>
                <Input
                  value={spec.header.gradeBand}
                  onChange={(e) =>
                    updateSpec((s) => ({ ...s, header: { ...s.header, gradeBand: e.target.value } }))
                  }
                  placeholder="např. 1. ročník SŠ"
                />
              </div>
              <div>
                <Label className="text-xs">Režim</Label>
                <Select
                  value={spec.header.worksheetMode}
                  onValueChange={(v) =>
                    updateSpec((s) => ({ ...s, header: { ...s.header, worksheetMode: v } }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODE_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Pokyny</Label>
                <Textarea
                  value={spec.header.instructions ?? ""}
                  onChange={(e) =>
                    updateSpec((s) => ({
                      ...s,
                      header: { ...s.header, instructions: e.target.value },
                    }))
                  }
                  placeholder="Pokyny pro žáka…"
                  rows={2}
                />
              </div>
            </div>

            {/* Bloky otázek */}
            {items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-3">Zatím žádné otázky.</p>
                <p className="text-sm">Přidej otázku z palety vlevo.</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <SortableItemBlock
                        key={item.id}
                        item={item}
                        selected={item.id === selectedId}
                        onSelect={() => setSelectedId(item.id)}
                        onDelete={() => deleteItem(item.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Add button */}
            <div className="mt-6 pt-4 border-t border-border">
              <Select onValueChange={(v) => addItem(v as ItemType)}>
                <SelectTrigger className="w-full">
                  <Plus className="w-4 h-4 mr-1" />
                  <SelectValue placeholder="Přidat otázku" />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ITEM_TYPE_LABELS[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* ── PROPERTIES ── */}
          <aside className="bg-card border border-border rounded-xl p-4 lg:sticky lg:top-[140px] lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
            <h3 className="font-heading text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Vlastnosti
            </h3>
            {!selectedItem ? (
              <p className="text-sm text-muted-foreground">Vyber blok pro úpravu.</p>
            ) : (
              <>
                <PropertiesPanel
                  item={selectedItem}
                  answerKey={selectedAnswer}
                  onUpdateItem={(p) => updateItem(selectedItem.id, p)}
                  onUpdateKey={(p) => updateAnswerKey(selectedItem.id, p)}
                />
                <AiBlockChat
                  item={selectedItem}
                  onApplyRefined={(refined) => replaceItem(selectedItem.id, refined)}
                />
              </>
            )}
          </aside>
        </div>
      </main>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Náhled pracovního listu</DialogTitle>
          </DialogHeader>
          <WorksheetPlayer
            spec={spec}
            variantId={spec.variants[0].variantId}
            attemptId={null}
          />
        </DialogContent>
      </Dialog>

      {/* AI Suggestions dialog */}
      <Dialog
        open={suggestionDialog.open}
        onOpenChange={(o) => setSuggestionDialog((d) => ({ ...d, open: o }))}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              AI návrhy úloh
            </DialogTitle>
            <DialogDescription className="text-xs">
              K pasáži: <span className="italic">{suggestionDialog.blockTitle}</span>
            </DialogDescription>
          </DialogHeader>

          {suggestionDialog.loading && (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Generuji návrhy…
            </div>
          )}

          {!suggestionDialog.loading && suggestionDialog.suggestions.length > 0 && (
            <div className="space-y-3">
              {suggestionDialog.suggestions.map((s, idx) => (
                <div
                  key={idx}
                  className="border border-border rounded-lg p-3 hover:border-primary/40 transition"
                >
                  <div className="flex items-center gap-2 mb-2 text-xs">
                    <Badge variant="secondary">
                      {ITEM_TYPE_LABELS[s.type]?.label ?? s.type}
                    </Badge>
                    <Badge variant="outline">
                      {s.difficulty === "easy"
                        ? "Lehká"
                        : s.difficulty === "medium"
                        ? "Střední"
                        : "Těžká"}
                    </Badge>
                    <Badge variant="outline">{s.points} b</Badge>
                  </div>
                  <p className="text-sm font-medium mb-1">{s.prompt}</p>
                  {s.choices && (
                    <ul className="text-xs text-muted-foreground list-disc list-inside mb-1">
                      {s.choices.map((c, i) => (
                        <li
                          key={i}
                          className={c === s.correctChoice ? "font-semibold text-foreground" : ""}
                        >
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11px] text-muted-foreground italic mb-2">
                    💡 {s.rationale}
                  </p>
                  <Button size="sm" onClick={() => applySuggestion(s)}>
                    <Plus className="w-3 h-3 mr-1" /> Přidat do listu
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Custom prompt */}
          <div className="border-t border-border pt-3 mt-2">
            <Label className="text-xs">Vlastní zadání pro AI</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="např. „udělej z toho test pravda/nepravda"
                value={suggestionDialog.customInstruction}
                onChange={(e) =>
                  setSuggestionDialog((d) => ({ ...d, customInstruction: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    fetchSuggestions(
                      suggestionDialog.blockText,
                      suggestionDialog.customInstruction,
                    );
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() =>
                  fetchSuggestions(
                    suggestionDialog.blockText,
                    suggestionDialog.customInstruction,
                  )
                }
                disabled={suggestionDialog.loading}
              >
                <Wand2 className="w-3 h-3 mr-1" /> Znovu
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────── SaveIndicator ───────────────────────────

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving")
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Ukládám…
      </span>
    );
  if (state === "saved")
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" /> Uloženo
      </span>
    );
  if (state === "error")
    return <span className="text-xs text-destructive">Chyba ukládání</span>;
  return null;
}

// ─────────────────────────── Sortable block (canvas) ───────────────────────────

function SortableItemBlock({
  item,
  selected,
  onSelect,
  onDelete,
}: {
  item: WorksheetItem;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isOffline = item.type === "offline_activity";
  const offlineMeta = isOffline && item.offlineMode ? OFFLINE_MODE_META[item.offlineMode] : null;
  const OfflineIcon = offlineMeta?.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-start gap-2 p-3 rounded-lg border transition-colors cursor-pointer ${
        selected
          ? "border-primary bg-primary/5"
          : isOffline
          ? "border-accent/40 bg-accent/5 hover:bg-accent/10"
          : "border-border bg-background hover:bg-muted/40"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground touch-none mt-0.5"
        onClick={(e) => e.stopPropagation()}
        aria-label="Přesunout"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted text-xs font-semibold flex items-center justify-center">
        {item.itemNumber}
      </div>
      <div className="flex-1 min-w-0">
        {isOffline && offlineMeta && OfflineIcon ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-foreground/80 mb-1">
            <OfflineIcon className="w-3.5 h-3.5 text-accent" />
            <span>
              {offlineMeta.label}
              {item.groupSize ? ` · ${GROUP_SIZE_LABELS[item.groupSize]}` : ""}
              {item.durationMin ? ` · ${item.durationMin} min` : ""}
            </span>
            <span className="text-muted-foreground font-normal">· {item.points} b</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground mb-0.5">
            {ITEM_TYPE_LABELS[item.type].label} · {item.points} b
          </div>
        )}
        <div className="text-sm line-clamp-2">
          {item.prompt || <em className="text-muted-foreground">Bez textu</em>}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="text-muted-foreground hover:text-destructive p-1"
        aria-label="Smazat"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─────────────────────────── AI Block Chat (properties panel) ───────────────────────────

function AiBlockChat({
  item,
  onApplyRefined,
}: {
  item: WorksheetItem;
  onApplyRefined: (refined: WorksheetItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [pending, setPending] = useState<{
    refinedBlock: WorksheetItem;
    changesSummary: string[];
  } | null>(null);

  async function runAction(action: string, customInstruction?: string) {
    setLoading(true);
    setPending(null);
    try {
      const { data, error } = await supabase.functions.invoke("worksheet-block-refine", {
        body: {
          block: item,
          action,
          customInstruction: customInstruction ?? "",
        },
      });
      if (error) throw error;
      setPending({
        refinedBlock: (data as any).refinedBlock as WorksheetItem,
        changesSummary: (data as any).changesSummary ?? [],
      });
    } catch (err: any) {
      toast({
        title: "AI úprava selhala",
        description: err?.message ?? "Zkuste to znovu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function applyPending() {
    if (!pending) return;
    onApplyRefined(pending.refinedBlock);
    setPending(null);
    setCustomPrompt("");
    toast({ title: "Úprava použita" });
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4 pt-3 border-t border-border">
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Zeptej se AI
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => runAction("simplify")}
          >
            Zjednodušit
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => runAction("harder")}
          >
            Ztížit
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => runAction("rephrase")}
          >
            Přeformulovat
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => runAction("add_hint")}
          >
            Přidat hint
          </Button>
        </div>

        <div className="flex gap-1.5">
          <Input
            placeholder="Vlastní pokyn…"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customPrompt.trim()) {
                runAction("custom", customPrompt.trim());
              }
            }}
            className="text-xs"
          />
          <Button
            size="sm"
            disabled={loading || !customPrompt.trim()}
            onClick={() => runAction("custom", customPrompt.trim())}
          >
            <Wand2 className="w-3 h-3" />
          </Button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> AI pracuje…
          </div>
        )}

        {pending && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-2.5 text-xs space-y-2">
            <p className="font-semibold text-foreground">Navržené změny:</p>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              {pending.changesSummary.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <p className="text-foreground">
              <span className="font-medium">Nový text:</span> {pending.refinedBlock.prompt}
            </p>
            <div className="flex gap-1.5">
              <Button size="sm" onClick={applyPending}>
                Použít
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
                Zahodit
              </Button>
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─────────────────────────── Properties panel ───────────────────────────

function PropertiesPanel({
  item,
  answerKey,
  onUpdateItem,
  onUpdateKey,
}: {
  item: WorksheetItem;
  answerKey: AnswerKeyEntry | null;
  onUpdateItem: (p: Partial<WorksheetItem>) => void;
  onUpdateKey: (p: Partial<AnswerKeyEntry>) => void;
}) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <Label className="text-xs">Otázka</Label>
        <Textarea
          value={item.prompt}
          onChange={(e) => onUpdateItem({ prompt: e.target.value })}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Body</Label>
          <Input
            type="number"
            min={0}
            value={item.points}
            onChange={(e) => onUpdateItem({ points: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label className="text-xs">Čas (s)</Label>
          <Input
            type="number"
            min={0}
            value={item.timeEstimateSec}
            onChange={(e) => onUpdateItem({ timeEstimateSec: Number(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Obtížnost</Label>
        <Select
          value={item.difficulty}
          onValueChange={(v) => onUpdateItem({ difficulty: v as Difficulty })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="easy">Lehká</SelectItem>
            <SelectItem value="medium">Střední</SelectItem>
            <SelectItem value="hard">Těžká</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {item.type === "mcq" && (
        <div>
          <Label className="text-xs mb-1 block">Volby (zaškrtni správnou)</Label>
          {(item.choices ?? []).map((c, idx) => {
            const correct = answerKey?.correctAnswer === c;
            return (
              <div key={idx} className="flex gap-2 mb-1.5">
                <button
                  type="button"
                  onClick={() => onUpdateKey({ correctAnswer: c })}
                  className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-xs ${
                    correct ? "bg-primary border-primary text-primary-foreground" : "border-border"
                  }`}
                  title="Označit jako správnou"
                >
                  {correct ? "✓" : ""}
                </button>
                <Input
                  value={c}
                  onChange={(e) => {
                    const next = [...(item.choices ?? [])];
                    next[idx] = e.target.value;
                    onUpdateItem({ choices: next });
                    if (correct) onUpdateKey({ correctAnswer: e.target.value });
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = (item.choices ?? []).filter((_, i) => i !== idx);
                    onUpdateItem({ choices: next });
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onUpdateItem({ choices: [...(item.choices ?? []), "Nová volba"] })}
          >
            <Plus className="w-3 h-3 mr-1" /> Přidat volbu
          </Button>
        </div>
      )}

      {item.type === "true_false" && (
        <div>
          <Label className="text-xs mb-1 block">Správná odpověď</Label>
          <Select
            value={String(answerKey?.correctAnswer ?? "true")}
            onValueChange={(v) => onUpdateKey({ correctAnswer: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Pravda</SelectItem>
              <SelectItem value="false">Nepravda</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {item.type === "fill_blank" && (
        <div>
          <Label className="text-xs">Text s ___ (3 podtržítka jako mezera)</Label>
          <Textarea
            value={item.blankText ?? ""}
            onChange={(e) => onUpdateItem({ blankText: e.target.value })}
            rows={3}
          />
          <Label className="text-xs mt-2">Správná odpověď (oddělená čárkami pro více mezer)</Label>
          <Input
            value={Array.isArray(answerKey?.correctAnswer) ? answerKey?.correctAnswer.join(", ") : (answerKey?.correctAnswer as string ?? "")}
            onChange={(e) =>
              onUpdateKey({
                correctAnswer: e.target.value.includes(",")
                  ? e.target.value.split(",").map((s) => s.trim())
                  : e.target.value,
              })
            }
          />
        </div>
      )}

      {item.type === "matching" && (
        <div>
          <Label className="text-xs mb-1 block">Páry</Label>
          {(item.matchPairs ?? []).map((p, idx) => (
            <div key={idx} className="flex gap-1 mb-1.5">
              <Input
                value={p.left}
                onChange={(e) => {
                  const next = [...(item.matchPairs ?? [])];
                  next[idx] = { ...next[idx], left: e.target.value };
                  onUpdateItem({ matchPairs: next });
                  onUpdateKey({ correctAnswer: next.map((x) => `${x.left}=${x.right}`) });
                }}
                placeholder="Levý"
              />
              <Input
                value={p.right}
                onChange={(e) => {
                  const next = [...(item.matchPairs ?? [])];
                  next[idx] = { ...next[idx], right: e.target.value };
                  onUpdateItem({ matchPairs: next });
                  onUpdateKey({ correctAnswer: next.map((x) => `${x.left}=${x.right}`) });
                }}
                placeholder="Pravý"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const next = (item.matchPairs ?? []).filter((_, i) => i !== idx);
                  onUpdateItem({ matchPairs: next });
                  onUpdateKey({ correctAnswer: next.map((x) => `${x.left}=${x.right}`) });
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const next = [...(item.matchPairs ?? []), { left: "", right: "" }];
              onUpdateItem({ matchPairs: next });
            }}
          >
            <Plus className="w-3 h-3 mr-1" /> Přidat pár
          </Button>
        </div>
      )}

      {item.type === "ordering" && (
        <div>
          <Label className="text-xs mb-1 block">Položky (ve správném pořadí)</Label>
          {(item.orderItems ?? []).map((o, idx) => (
            <div key={idx} className="flex gap-1 mb-1.5">
              <span className="text-xs text-muted-foreground self-center w-4">{idx + 1}.</span>
              <Input
                value={o}
                onChange={(e) => {
                  const next = [...(item.orderItems ?? [])];
                  next[idx] = e.target.value;
                  onUpdateItem({ orderItems: next });
                  onUpdateKey({ correctAnswer: next });
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const next = (item.orderItems ?? []).filter((_, i) => i !== idx);
                  onUpdateItem({ orderItems: next });
                  onUpdateKey({ correctAnswer: next });
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const next = [...(item.orderItems ?? []), "Nová položka"];
              onUpdateItem({ orderItems: next });
              onUpdateKey({ correctAnswer: next });
            }}
          >
            <Plus className="w-3 h-3 mr-1" /> Přidat položku
          </Button>
        </div>
      )}

      {item.type === "short_answer" && (
        <div>
          <Label className="text-xs">Správná odpověď</Label>
          <Input
            value={(answerKey?.correctAnswer as string) ?? ""}
            onChange={(e) => onUpdateKey({ correctAnswer: e.target.value })}
          />
          <Label className="text-xs mt-2">Vysvětlení (volitelné)</Label>
          <Textarea
            value={answerKey?.explanation ?? ""}
            onChange={(e) => onUpdateKey({ explanation: e.target.value })}
            rows={2}
          />
        </div>
      )}

      {item.type === "open_answer" && (
        <div>
          <Label className="text-xs">Hodnotící kritéria (rubric)</Label>
          <Textarea
            value={answerKey?.rubric ?? ""}
            onChange={(e) => onUpdateKey({ rubric: e.target.value })}
            rows={3}
          />
        </div>
      )}

      {item.type === "offline_activity" && (
        <div className="space-y-3 rounded-lg border border-dashed border-accent/40 bg-accent/5 p-3">
          <div>
            <Label className="text-xs">Režim aktivity</Label>
            <Select
              value={item.offlineMode ?? "discussion"}
              onValueChange={(v) => onUpdateItem({ offlineMode: v as OfflineMode })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(OFFLINE_MODE_LABELS) as [OfflineMode, string][]).map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Velikost skupiny</Label>
              <Select
                value={item.groupSize ?? "class"}
                onValueChange={(v) => onUpdateItem({ groupSize: v as GroupSize })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(GROUP_SIZE_LABELS) as [GroupSize, string][]).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Délka (min)</Label>
              <Input
                type="number"
                min={0}
                value={item.durationMin ?? 0}
                onChange={(e) =>
                  onUpdateItem({
                    durationMin: Number(e.target.value) || 0,
                    timeEstimateSec: (Number(e.target.value) || 0) * 60,
                  })
                }
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Pokyny pro hodnocení (volitelné)</Label>
            <Textarea
              value={answerKey?.rubric ?? ""}
              onChange={(e) => onUpdateKey({ rubric: e.target.value })}
              rows={2}
              placeholder="Např. body za aktivní účast, splnění zadání…"
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Offline aktivity probíhají mimo zařízení. Studenti je v online přehrávači uvidí jako
            informativní kartu, body přiděluje učitel ručně.
          </p>
        </div>
      )}

      <div className="pt-3 border-t border-border">
        <Label className="text-xs">Obrázek (URL, volitelné)</Label>
        <Input
          value={item.imageUrl ?? ""}
          onChange={(e) => onUpdateItem({ imageUrl: e.target.value || undefined })}
          placeholder="https://…"
        />
        {item.imageUrl && (
          <Input
            className="mt-1"
            value={item.imageAlt ?? ""}
            onChange={(e) => onUpdateItem({ imageAlt: e.target.value })}
            placeholder="Popisek obrázku"
          />
        )}
      </div>

      <div className="pt-3 border-t border-border">
        <Label className="text-xs">Prostor pro odpověď (tisk)</Label>
        <Select
          value={item.answerSpace.type}
          onValueChange={(v) =>
            onUpdateItem({
              answerSpace: { ...item.answerSpace, type: v as any },
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Žádný</SelectItem>
            <SelectItem value="lines">Linky</SelectItem>
            <SelectItem value="grid">Mřížka</SelectItem>
            <SelectItem value="blank">Prázdný box</SelectItem>
          </SelectContent>
        </Select>
        {item.answerSpace.type !== "none" && (
          <div className="grid grid-cols-2 gap-2 mt-1">
            <Input
              type="number"
              value={item.answerSpace.heightMm}
              onChange={(e) =>
                onUpdateItem({
                  answerSpace: { ...item.answerSpace, heightMm: Number(e.target.value) || 0 },
                })
              }
              placeholder="Výška (mm)"
            />
            {item.answerSpace.type === "lines" && (
              <Input
                type="number"
                value={item.answerSpace.lineCount ?? 0}
                onChange={(e) =>
                  onUpdateItem({
                    answerSpace: { ...item.answerSpace, lineCount: Number(e.target.value) || 0 },
                  })
                }
                placeholder="Počet linek"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
