import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  Link2,
  XCircle,
  Menu,
  PanelRight,
  CalendarClock,
  Clock,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
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
import {
  splitLessonContent,
  extractTextFromBlocks,
  type LessonBlock,
} from "@/lib/lesson-content-splitter";
import { useSubjects } from "@/hooks/useSubjects";

type LessonOption = {
  id: string;
  title: string;
  type: "global" | "teacher";
  textbookId: string | null;
};
import {
  WORKSHEET_TEMPLATES,
  buildTemplate,
  type WorksheetTemplateId,
} from "@/lib/worksheet-templates";
import { downloadWorksheetPdf, buildWorksheetPdfBlobUrl } from "@/lib/worksheet-pdf-export";
import WorksheetPlayer from "@/components/WorksheetPlayer";
import LinkedLessonsDialog, { type LessonChoice } from "@/components/admin/LinkedLessonsDialog";

interface LinkedLessonRow {
  id: string; // worksheet_lessons.id
  lesson_id: string;
  lesson_type: "global" | "teacher";
  title: string;
}

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

function pointsLabel(n: number): string {
  if (n === 1) return "bod";
  if (n >= 2 && n <= 4) return "body";
  return "bodů";
}

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

// ─── SchedulePicker ──────────────────────────────────────────────
function pad(n: number) {
  return String(n).padStart(2, "0");
}

function SchedulePicker({
  initial,
  onCancel,
  onConfirm,
}: {
  initial: Date;
  onCancel: () => void;
  onConfirm: (d: Date) => void;
}) {
  const [date, setDate] = useState<Date | undefined>(initial);
  const [time, setTime] = useState<string>(`${pad(initial.getHours())}:${pad(initial.getMinutes())}`);

  function buildDate(): Date | null {
    if (!date) return null;
    const [hh, mm] = time.split(":").map((x) => Number(x));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    const d = new Date(date);
    d.setHours(hh, mm, 0, 0);
    return d;
  }

  const target = buildDate();
  const inFuture = target && target.getTime() > Date.now();

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs mb-2 block">Datum</Label>
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
          initialFocus
          className="p-3 pointer-events-auto rounded-md border"
        />
      </div>
      <div>
        <Label className="text-xs mb-2 block flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Čas
        </Label>
        <Input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </div>
      {target && !inFuture && (
        <p className="text-xs text-destructive">Vyber budoucí čas.</p>
      )}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Zrušit
        </Button>
        <Button
          size="sm"
          onClick={() => target && inFuture && onConfirm(target)}
          disabled={!target || !inFuture}
        >
          <CalendarClock className="w-4 h-4 mr-1" /> Naplánovat
        </Button>
      </div>
    </div>
  );
}

export default function WorksheetEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: subjectsList } = useSubjects(true);

  const [spec, setSpec] = useState<WorksheetSpec | null>(null);
  const [status, setStatus] = useState<"draft" | "published" | "scheduled">("draft");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [mobilePropsOpen, setMobilePropsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfIncludeAnswerKey, setPdfIncludeAnswerKey] = useState(false);
  const [pdfIncludeNameField, setPdfIncludeNameField] = useState(true);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [subjectComboOpen, setSubjectComboOpen] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState("");

  const [sourceLessonId, setSourceLessonId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [allLessons, setAllLessons] = useState<LessonOption[]>([]);
  const [activeLessonContent, setActiveLessonContent] = useState<string>("");
  const [linkedLessons, setLinkedLessons] = useState<LinkedLessonRow[]>([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const fromLessonId = searchParams.get("from_lesson");
  const fromLessonType = (searchParams.get("from_lesson_type") as "global" | "teacher" | null) || null;
  const returnTo = searchParams.get("return_to");
  const autoLinkAttempted = useRef(false);

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
      setScheduledAt(row.scheduled_publish_at ? new Date(row.scheduled_publish_at) : null);
      setSourceLessonId(row.source_lesson_id ?? null);
      setActiveLessonId(row.source_lesson_id ?? null);
      setLoading(false);
      initialLoad.current = false;
    })();
  }, [authLoading, user, id, navigate]);

  // ── Načtení seznamu lekcí (globální + učitelské) pro Combobox ──
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [globalRes, teacherRes] = await Promise.all([
        supabase
          .from("textbook_lessons")
          .select("id, title, topic_id")
          .order("title", { ascending: true })
          .limit(500),
        supabase
          .from("teacher_textbook_lessons")
          .select("id, title, textbook_id")
          .order("title", { ascending: true })
          .limit(200),
      ]);
      const merged: LessonOption[] = [
        ...(((globalRes.data ?? []) as any[]).map((l) => ({
          id: l.id,
          title: l.title,
          type: "global" as const,
          textbookId: l.topic_id ?? null,
        }))),
        ...(((teacherRes.data ?? []) as any[]).map((l) => ({
          id: l.id,
          title: l.title,
          type: "teacher" as const,
          textbookId: l.textbook_id ?? null,
        }))),
      ];
      setAllLessons(merged);
    })();
  }, [user]);

  // ── Načtení obsahu vybrané lekce (z odpovídající tabulky) ──
  useEffect(() => {
    if (!activeLessonId) {
      setActiveLessonContent("");
      return;
    }
    const opt = allLessons.find((l) => l.id === activeLessonId);
    if (!opt) {
      // může se stát před prvním načtením seznamu — zkusíme oba zdroje
      return;
    }
    (async () => {
      const tableName =
        opt.type === "global" ? "textbook_lessons" : "teacher_textbook_lessons";
      const { data } = await supabase
        .from(tableName as any)
        .select("blocks, title")
        .eq("id", activeLessonId)
        .maybeSingle();
      const row = (data as any) ?? {};
      // obě tabulky používají jsonb `blocks`
      setActiveLessonContent(extractTextFromBlocks(row.blocks));
    })();
  }, [activeLessonId, allLessons]);

  // ── Load linked lessons ──
  const loadLinkedLessons = useCallback(async () => {
    if (!id) return;
    const { data: links } = await supabase
      .from("worksheet_lessons" as any)
      .select("id, lesson_id, lesson_type")
      .eq("worksheet_id", id);
    const rows = ((links as any[]) ?? []) as Array<{
      id: string;
      lesson_id: string;
      lesson_type: "global" | "teacher";
    }>;
    if (rows.length === 0) {
      setLinkedLessons([]);
      return;
    }
    const globalIds = rows.filter((r) => r.lesson_type === "global").map((r) => r.lesson_id);
    const teacherIds = rows.filter((r) => r.lesson_type === "teacher").map((r) => r.lesson_id);
    const [gRes, tRes] = await Promise.all([
      globalIds.length
        ? supabase.from("textbook_lessons").select("id, title").in("id", globalIds)
        : Promise.resolve({ data: [] as any[] }),
      teacherIds.length
        ? supabase.from("teacher_textbook_lessons").select("id, title").in("id", teacherIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const titleMap = new Map<string, string>();
    ((gRes.data ?? []) as any[]).forEach((l) => titleMap.set(`global-${l.id}`, l.title));
    ((tRes.data ?? []) as any[]).forEach((l) => titleMap.set(`teacher-${l.id}`, l.title));
    setLinkedLessons(
      rows.map((r) => ({
        id: r.id,
        lesson_id: r.lesson_id,
        lesson_type: r.lesson_type,
        title: titleMap.get(`${r.lesson_type}-${r.lesson_id}`) ?? "(neznámá lekce)",
      }))
    );
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    void loadLinkedLessons();
  }, [id, user, loadLinkedLessons]);

  // ── Auto-link lesson from URL (?from_lesson=...&from_lesson_type=...) ──
  useEffect(() => {
    if (!id || !user || !fromLessonId || !fromLessonType) return;
    if (autoLinkAttempted.current) return;
    autoLinkAttempted.current = true;
    (async () => {
      await supabase.from("worksheet_lessons" as any).insert({
        worksheet_id: id,
        lesson_id: fromLessonId,
        lesson_type: fromLessonType,
        added_by: user.id,
      } as any);
      // also set as source if not yet set
      if (!sourceLessonId) {
        await supabase
          .from("worksheets" as any)
          .update({ source_lesson_id: fromLessonId, source_lesson_type: fromLessonType } as any)
          .eq("id", id);
        setSourceLessonId(fromLessonId);
        setActiveLessonId(fromLessonId);
      }
      void loadLinkedLessons();
    })();
  }, [id, user, fromLessonId, fromLessonType, sourceLessonId, loadLinkedLessons]);

  // ── Auto-save (s pending payload, který přežije unmount) ──
  const pendingSaveRef = useRef<Record<string, any> | null>(null);

  useEffect(() => {
    if (loading || !spec || !id) return;
    if (initialLoad.current) return;

    const payload = {
      title: spec.header.title,
      subject: spec.header.subject,
      grade_band: spec.header.gradeBand,
      worksheet_mode: spec.header.worksheetMode,
      spec: spec as any,
    } as Record<string, any>;
    pendingSaveRef.current = payload;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");

    saveTimer.current = setTimeout(async () => {
      const toSave = pendingSaveRef.current;
      if (!toSave) return;
      pendingSaveRef.current = null;
      const { error } = await supabase
        .from("worksheets" as any)
        .update(toSave as any)
        .eq("id", id);
      if (error) {
        setSaveState("error");
        pendingSaveRef.current = toSave; // ulož zpět pro retry
        toast({ title: "Ukládání selhalo", description: error.message, variant: "destructive" });
      } else {
        setSaveState("saved");
      }
    }, 1000);

    // Pozor: NEMAZAT timer při cleanup — chceme, aby pending save dokončil.
  }, [spec, id, loading]);

  // Flush při unmount (fire-and-forget)
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current && id) {
        const toSave = pendingSaveRef.current;
        pendingSaveRef.current = null;
        // Fire-and-forget — prohlížeč request dokončí
        void supabase.from("worksheets" as any).update(toSave as any).eq("id", id);
      }
    };
  }, [id]);

  // Varování před zavřením okna s neuloženými změnami
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (pendingSaveRef.current) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Flush save + navigace zpět
  const handleBack = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingSaveRef.current && id) {
      const toSave = pendingSaveRef.current;
      pendingSaveRef.current = null;
      setSaveState("saving");
      const { error } = await supabase
        .from("worksheets" as any)
        .update(toSave as any)
        .eq("id", id);
      if (error) {
        setSaveState("error");
        pendingSaveRef.current = toSave;
        toast({ title: "Nepodařilo se uložit", description: error.message, variant: "destructive" });
        return;
      }
      setSaveState("saved");
    }
    navigate("/ucitel/pracovni-listy");
  }, [id, navigate]);

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

  function addTemplate(templateId: WorksheetTemplateId) {
    if (!spec) return;
    const variantId = spec.variants[0].variantId;
    const startNumber = items.length + 1;
    const { items: newItems, keys: newKeys } = buildTemplate(templateId, startNumber);
    const tpl = WORKSHEET_TEMPLATES.find((t) => t.id === templateId);
    updateSpec((s) => ({
      ...s,
      variants: s.variants.map((v, idx) =>
        idx === 0 ? { ...v, items: [...v.items, ...newItems] } : v
      ),
      answerKeys: {
        ...s.answerKeys,
        [variantId]: [...(s.answerKeys[variantId] ?? []), ...newKeys],
      },
    }));
    toast({
      title: `Šablona „${tpl?.label}" přidána`,
      description: `${newItems.length} bloků vloženo na konec.`,
    });
  }

  async function handleExportPdf() {
    if (!spec || !id) return;
    setPdfExporting(true);
    try {
      await downloadWorksheetPdf(spec, {
        worksheetId: id,
        includeAnswerKey: pdfIncludeAnswerKey,
        includeNameField: pdfIncludeNameField,
      });
      toast({
        title: "Print dialog otevřen",
        description: 'Pro čistý výstup vypni v dialogu „Záhlaví a zápatí" (More settings → Headers and footers). Pak zvol „Uložit jako PDF" nebo Tisk.',
        duration: 6000,
      });
      setPdfDialogOpen(false);
    } catch (e: any) {
      toast({
        title: "Export PDF selhal",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setPdfExporting(false);
    }
  }

  async function handlePreviewPdf() {
    if (!spec || !id) return;
    setPdfPreviewLoading(true);
    try {
      const url = await buildWorksheetPdfBlobUrl(spec, {
        worksheetId: id,
        includeAnswerKey: pdfIncludeAnswerKey,
        includeNameField: pdfIncludeNameField,
      });
      setPdfPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e: any) {
      toast({
        title: "Náhled PDF selhal",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setPdfPreviewLoading(false);
    }
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
      .update({ status: next, scheduled_publish_at: null } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Změna stavu selhala", description: error.message, variant: "destructive" });
    } else {
      setStatus(next);
      setScheduledAt(null);
      toast({ title: next === "published" ? "Publikováno" : "Vráceno do konceptu" });
    }
  }

  async function schedulePublish(when: Date) {
    if (!id) return;
    if (when.getTime() <= Date.now()) {
      toast({ title: "Vyber budoucí čas", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("worksheets" as any)
      .update({ status: "scheduled", scheduled_publish_at: when.toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Naplánování selhalo", description: error.message, variant: "destructive" });
      return;
    }
    setStatus("scheduled");
    setScheduledAt(when);
    setScheduleDialogOpen(false);
    toast({ title: "Naplánováno", description: when.toLocaleString("cs-CZ") });
  }

  async function cancelSchedule() {
    if (!id) return;
    const { error } = await supabase
      .from("worksheets" as any)
      .update({ status: "draft", scheduled_publish_at: null } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Zrušení selhalo", description: error.message, variant: "destructive" });
      return;
    }
    setStatus("draft");
    setScheduledAt(null);
    toast({ title: "Plánované publikování zrušeno" });
  }

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);


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

  async function handleAddLinkedLessons(selected: LessonChoice[]) {
    if (!id || !user || selected.length === 0) return;
    const rows = selected.map((s) => ({
      worksheet_id: id,
      lesson_id: s.id,
      lesson_type: s.type,
      added_by: user.id,
    }));
    const { error } = await supabase.from("worksheet_lessons" as any).insert(rows as any);
    if (error) {
      toast({ title: "Nepodařilo se připojit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Připojeno: ${selected.length} ${selected.length === 1 ? "lekce" : "lekcí"}` });
    // UX: pokud zatím není aktivní lekce, nastav první nově přidanou
    if (!activeLessonId && selected[0]) {
      void handleSetSourceLesson(selected[0].id);
    }
    void loadLinkedLessons();
  }

  async function handleRemoveLinkedLesson(linkId: string) {
    const removed = linkedLessons.find((l) => l.id === linkId);
    const { error } = await supabase.from("worksheet_lessons" as any).delete().eq("id", linkId);
    if (error) {
      toast({ title: "Nepodařilo se odebrat", description: error.message, variant: "destructive" });
      return;
    }
    // UX: pokud byla odstraněná lekce zrovna aktivní, vyber jinou nebo vyčisti
    if (removed && removed.lesson_id === activeLessonId) {
      const remaining = linkedLessons.filter((l) => l.id !== linkId);
      void handleSetSourceLesson(remaining[0]?.lesson_id ?? null);
    }
    void loadLinkedLessons();
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

  const paletteContent = (
    <>
      <h3 className="font-heading text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
        Otázky
      </h3>
      <div className="space-y-1.5">
        {ITEM_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => { addItem(type); setMobilePaletteOpen(false); }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors border border-transparent hover:border-border"
          >
            <div className="text-sm font-medium">{ITEM_TYPE_LABELS[type].label}</div>
            <div className="text-xs text-muted-foreground line-clamp-1">
              {ITEM_TYPE_LABELS[type].description}
            </div>
          </button>
        ))}
      </div>

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
                onClick={() => { addOfflineActivity(mode); setMobilePaletteOpen(false); }}
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

      <div className="mt-5 pt-4 border-t border-border">
        <h3 className="font-heading text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" /> Aktivní lekce
        </h3>
        <p className="text-[11px] text-muted-foreground mb-2">
          Lekce, ze které právě tahám návrhy.
        </p>
        <Select
          value={activeLessonId ?? "__none__"}
          onValueChange={(v) => handleSetSourceLesson(v === "__none__" ? null : v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Vyber lekci…" />
          </SelectTrigger>
          <SelectContent className="max-h-[60vh]">
            <SelectItem value="__none__">— Žádná —</SelectItem>
            {allLessons.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Žádné lekce k dispozici
              </div>
            )}
            {allLessons.map((l) => (
              <SelectItem key={`${l.type}-${l.id}`} value={l.id}>
                <span className="inline-flex items-center gap-1.5">
                  <Badge
                    variant={l.type === "global" ? "secondary" : "outline"}
                    className="text-[10px] px-1.5 py-0 h-4"
                  >
                    {l.type === "global" ? "Globální" : "Vlastní"}
                  </Badge>
                  <span className="truncate">{l.title}</span>
                </span>
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

      <div className="mt-5 pt-4 border-t border-border">
        <h3 className="font-heading text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" /> Připojené lekce ({linkedLessons.length})
        </h3>
        {linkedLessons.length === 0 ? (
          <p className="text-[11px] text-muted-foreground mb-2">
            Tento pracovní list zatím není napojený na žádnou lekci.
          </p>
        ) : (
          <div className="space-y-1 mb-2">
            {linkedLessons.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border bg-background text-xs"
              >
                <Badge
                  variant={l.lesson_type === "global" ? "secondary" : "outline"}
                  className="text-[10px] px-1.5 py-0 h-4 shrink-0"
                >
                  {l.lesson_type === "global" ? "G" : "V"}
                </Badge>
                <span className="truncate flex-1" title={l.title}>
                  {l.title}
                </span>
                <button
                  onClick={() => handleRemoveLinkedLesson(l.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  title="Odebrat propojení"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={() => setLinkDialogOpen(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Přidat další lekci
        </Button>
      </div>

      <Collapsible defaultOpen={false} className="mt-5 pt-4 border-t border-border">
        <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide font-heading mb-2 hover:text-foreground transition-colors">
          <span className="flex items-center gap-1.5">
            <LayoutTemplate className="w-3.5 h-3.5" /> Šablony
          </span>
          <ChevronDown className="w-3.5 h-3.5" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1.5">
          {WORKSHEET_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => { addTemplate(tpl.id); setMobilePaletteOpen(false); }}
              className="w-full text-left px-2.5 py-2 rounded-md border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition text-xs"
              title={`Vloží ${tpl.blockCount} bloků`}
            >
              <div className="font-medium text-sm flex items-center gap-1.5">
                <LayoutTemplate className="w-3 h-3 text-primary" />
                {tpl.label}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                {tpl.description}
              </div>
            </button>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground">
        <p className="mb-1">{items.length} otázek</p>
        {(spec.renderConfig?.pointsEnabled ?? true) && (
          <p className="mb-1">{spec.metadata.totalPoints} {pointsLabel(spec.metadata.totalPoints)}</p>
        )}
        <p>~{spec.metadata.totalTimeMin} min</p>
      </div>
    </>
  );

  const propertiesContent = (
    <>
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
            pointsEnabled={spec.renderConfig?.pointsEnabled ?? true}
            onUpdateItem={(p) => updateItem(selectedItem.id, p)}
            onUpdateKey={(p) => updateAnswerKey(selectedItem.id, p)}
          />
          <AiBlockChat
            item={selectedItem}
            onApplyRefined={(refined) => replaceItem(selectedItem.id, refined)}
          />
        </>
      )}
    </>
  );


  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      {/* Spacer for fixed SiteHeader (h ~70px) */}
      <div aria-hidden className="h-[70px] shrink-0" />

      {/* Sticky toolbar */}
      <div
        className="sticky z-30 bg-background/95 backdrop-blur border-b border-border"
        style={{ top: "70px" }}
      >
        <div className="container mx-auto px-4 py-3 flex items-center gap-2 sm:gap-3 max-w-[1600px]">
          <Button variant="ghost" size="sm" onClick={handleBack} className="shrink-0">
            <ChevronLeft className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Zpět</span>
          </Button>

          {/* Mobile: open palette drawer */}
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden shrink-0"
            onClick={() => setMobilePaletteOpen(true)}
            title="Otevřít paletu"
          >
            <Menu className="w-4 h-4" />
          </Button>

          <Input
            value={spec.header.title}
            onChange={(e) =>
              updateSpec((s) => ({ ...s, header: { ...s.header, title: e.target.value } }))
            }
            className="font-heading text-sm sm:text-base font-semibold border-0 shadow-none focus-visible:ring-1 min-w-0 flex-1 sm:flex-none sm:max-w-md"
          />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={undo}
              title="Zpět (Ctrl+Z)"
              disabled={historyRef.current.length === 0}
              className="hidden sm:inline-flex"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <div className="hidden md:block">
              <SaveIndicator state={saveState} />
            </div>
            <div className="hidden md:flex items-center gap-2 px-2 border-l border-border ml-1">
              <Switch
                id="points-enabled"
                checked={spec.renderConfig?.pointsEnabled ?? true}
                onCheckedChange={(checked) =>
                  updateSpec((s) => ({
                    ...s,
                    renderConfig: { ...s.renderConfig, pointsEnabled: checked },
                  }))
                }
              />
              <Label htmlFor="points-enabled" className="text-xs cursor-pointer whitespace-nowrap">
                {(spec.renderConfig?.pointsEnabled ?? true) ? "Bodované" : "Nebodované"}
              </Label>
            </div>
            {(spec.renderConfig?.pointsEnabled ?? true) && (
              <Badge variant="outline" className="hidden lg:inline-flex whitespace-nowrap">
                Celkem: {spec.metadata.totalPoints} {pointsLabel(spec.metadata.totalPoints)}
              </Badge>
            )}
            <Badge
              variant={status === "published" ? "default" : status === "scheduled" ? "outline" : "secondary"}
              className="hidden sm:inline-flex"
            >
              {status === "published"
                ? "Publikováno"
                : status === "scheduled"
                  ? scheduledAt
                    ? `Naplánováno · ${scheduledAt.toLocaleDateString("cs-CZ")} ${scheduledAt.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`
                    : "Naplánováno"
                  : "Koncept"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="hidden sm:inline-flex">
              <Eye className="w-4 h-4 mr-1" /> Náhled
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPdfDialogOpen(true)} className="hidden md:inline-flex">
              <Printer className="w-4 h-4 mr-1" /> Tisk/PDF
            </Button>

            {/* Publish dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Send className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">
                    {status === "published"
                      ? "Publikováno"
                      : status === "scheduled"
                        ? "Naplánováno"
                        : "Publikovat"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover">
                {status !== "published" && (
                  <DropdownMenuItem onClick={togglePublish}>
                    <Send className="w-4 h-4 mr-2" /> Publikovat hned
                  </DropdownMenuItem>
                )}
                {status === "published" && (
                  <DropdownMenuItem onClick={togglePublish}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Vrátit do konceptu
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setScheduleDialogOpen(true)}>
                  <CalendarClock className="w-4 h-4 mr-2" />
                  {status === "scheduled" ? "Změnit termín…" : "Naplánovat publikaci…"}
                </DropdownMenuItem>
                {status === "scheduled" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={cancelSchedule} className="text-destructive">
                      <X className="w-4 h-4 mr-2" /> Zrušit plán
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile: open properties drawer */}
            <Button
              variant="outline"
              size="sm"
              className="lg:hidden shrink-0"
              onClick={() => setMobilePropsOpen(true)}
              title="Vlastnosti"
            >
              <PanelRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 pt-8 pb-6 max-w-[1600px] w-full">
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_340px]">
          {/* ── PALETA ── */}
          <aside className="hidden lg:block bg-card border border-border rounded-xl p-4 lg:sticky lg:top-[140px] lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto">
            {paletteContent}
          </aside>

          {/* ── CANVAS ── */}
          <section className="bg-card border border-border rounded-xl p-6 min-w-0">
            {/* Hlavička pracovního listu */}
            <div className="grid sm:grid-cols-2 gap-3 mb-6 pb-6 border-b border-border">
              <div>
                <Label className="text-xs">Předmět</Label>
                {(() => {
                  const subjects = subjectsList ?? [];
                  const currentValue = spec.header.subject || "";
                  const matchedSubject = subjects.find(
                    (s) => s.slug === currentValue || s.label === currentValue,
                  );
                  const displayLabel = matchedSubject?.label || currentValue;
                  const hasMatchInList =
                    !subjectSearch ||
                    subjects.some(
                      (s) =>
                        s.label.toLowerCase() === subjectSearch.toLowerCase() ||
                        s.slug.toLowerCase() === subjectSearch.toLowerCase(),
                    );
                  const setSubject = (val: string) =>
                    updateSpec((st) => ({
                      ...st,
                      header: { ...st.header, subject: val },
                    }));
                  return (
                    <Popover open={subjectComboOpen} onOpenChange={setSubjectComboOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={subjectComboOpen}
                          className="w-full justify-between font-normal"
                        >
                          <span className="inline-flex items-center gap-2 truncate">
                            {matchedSubject && (
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: matchedSubject.color }}
                              />
                            )}
                            <span className="truncate">
                              {displayLabel || "Vyber nebo napiš předmět…"}
                            </span>
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover"
                        align="start"
                      >
                        <Command>
                          <CommandInput
                            placeholder="Hledej nebo napiš nový…"
                            value={subjectSearch}
                            onValueChange={setSubjectSearch}
                          />
                          <CommandList>
                            <CommandEmpty>Žádný předmět nenalezen.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="__none__"
                                onSelect={() => {
                                  setSubject("");
                                  setSubjectComboOpen(false);
                                  setSubjectSearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !currentValue ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                — Nezadáno —
                              </CommandItem>
                              {subjects.map((s) => (
                                <CommandItem
                                  key={s.id}
                                  value={s.label}
                                  onSelect={() => {
                                    setSubject(s.slug);
                                    setSubjectComboOpen(false);
                                    setSubjectSearch("");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      matchedSubject?.id === s.id ? "opacity-100" : "opacity-0",
                                    )}
                                  />
                                  <span
                                    className="w-2 h-2 rounded-full mr-2"
                                    style={{ backgroundColor: s.color }}
                                  />
                                  {s.label}
                                </CommandItem>
                              ))}
                              {subjectSearch && !hasMatchInList && (
                                <CommandItem
                                  value={`__custom__${subjectSearch}`}
                                  onSelect={() => {
                                    setSubject(subjectSearch);
                                    setSubjectComboOpen(false);
                                    setSubjectSearch("");
                                  }}
                                  className="border-t"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Použít vlastní: „{subjectSearch}"
                                </CommandItem>
                              )}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  );
                })()}
              </div>
              <div>
                <Label className="text-xs">Ročník</Label>
                <Select
                  value={spec.header.gradeBand || "__none__"}
                  onValueChange={(v) =>
                    updateSpec((s) => ({
                      ...s,
                      header: { ...s.header, gradeBand: v === "__none__" ? "" : v },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyber ročník…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Nezadáno —</SelectItem>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                      <SelectItem key={n} value={`${n}. ročník`}>
                        {n}. ročník
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                        pointsEnabled={spec.renderConfig?.pointsEnabled ?? true}
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
          <aside className="hidden lg:block bg-card border border-border rounded-xl p-4 min-w-0 lg:sticky lg:top-[140px] lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto lg:overflow-x-hidden">
            {propertiesContent}
          </aside>
        </div>
      </main>

      {/* Mobile drawers (palette + properties) */}
      <Sheet open={mobilePaletteOpen} onOpenChange={setMobilePaletteOpen}>
        <SheetContent side="left" className="w-[88vw] sm:max-w-sm overflow-y-auto p-4">
          <SheetHeader className="mb-3">
            <SheetTitle>Paleta</SheetTitle>
          </SheetHeader>
          {paletteContent}
        </SheetContent>
      </Sheet>

      <Sheet open={mobilePropsOpen} onOpenChange={setMobilePropsOpen}>
        <SheetContent side="right" className="w-[92vw] sm:max-w-md overflow-y-auto p-4">
          <SheetHeader className="mb-3">
            <SheetTitle>Vlastnosti bloku</SheetTitle>
          </SheetHeader>
          {propertiesContent}
        </SheetContent>
      </Sheet>

      {/* Schedule publish dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Naplánovat publikaci</DialogTitle>
            <DialogDescription>
              Pracovní list se automaticky publikuje ve zvolený čas.
            </DialogDescription>
          </DialogHeader>
          <SchedulePicker
            initial={scheduledAt ?? new Date(Date.now() + 60 * 60 * 1000)}
            onCancel={() => setScheduleDialogOpen(false)}
            onConfirm={(d) => schedulePublish(d)}
          />
        </DialogContent>
      </Dialog>

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

      {/* PDF Export dialog */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export PDF</DialogTitle>
            <DialogDescription>
              PDF bude obsahovat QR kód s odkazem na online verzi pro žáky.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg bg-muted/30">
              <div>
                <Label className="text-sm">Pole pro jméno žáka</Label>
                <p className="text-xs text-muted-foreground">Hlavička s linkou pro jméno.</p>
              </div>
              <Switch
                checked={pdfIncludeNameField}
                onCheckedChange={setPdfIncludeNameField}
              />
            </div>
            <div className="flex items-center justify-between gap-3 p-3 border border-border rounded-lg bg-muted/30">
              <div>
                <Label className="text-sm">Zahrnout odpověďový klíč</Label>
                <p className="text-xs text-muted-foreground">Učitelská verze – pouze pro vlastní použití.</p>
              </div>
              <Switch
                checked={pdfIncludeAnswerKey}
                onCheckedChange={setPdfIncludeAnswerKey}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPdfDialogOpen(false)} disabled={pdfExporting}>
                Zrušit
              </Button>
              <Button variant="outline" onClick={handlePreviewPdf} disabled={pdfPreviewLoading || pdfExporting}>
                {pdfPreviewLoading ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4 mr-1" />
                )}
                Náhled
              </Button>
              <Button onClick={handleExportPdf} disabled={pdfExporting}>
                {pdfExporting ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 mr-1" />
                )}
                Tisk / PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Preview dialog */}
      <Dialog
        open={!!pdfPreviewUrl}
        onOpenChange={(o) => {
          if (!o) {
            if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
            setPdfPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Náhled PDF</DialogTitle>
            <DialogDescription>
              Takhle bude vypadat pracovní list pro žáky.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {pdfPreviewUrl && (
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full border rounded"
                title="Náhled pracovního listu"
              />
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleExportPdf} disabled={pdfExporting}>
              {pdfExporting ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 mr-1" />
              )}
              Tisk / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



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

      <LinkedLessonsDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        allLessons={allLessons.map((l) => ({ id: l.id, title: l.title, type: l.type }))}
        alreadyLinkedKeys={
          new Set(linkedLessons.map((l) => `${l.lesson_type}-${l.lesson_id}`))
        }
        onConfirm={handleAddLinkedLessons}
      />

      {returnTo && id && (
        <div className="fixed bottom-4 right-4 z-40 bg-card border border-border rounded-xl shadow-lg p-3 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Pokračovat zpět do úkolu:</span>
          <Button
            size="sm"
            onClick={() => {
              const sep = returnTo.includes("?") ? "&" : "?";
              navigate(`${returnTo}${sep}worksheetId=${id}`);
            }}
          >
            Vrátit se k úkolu
          </Button>
        </div>
      )}
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
  pointsEnabled,
  onSelect,
  onDelete,
}: {
  item: WorksheetItem;
  selected: boolean;
  pointsEnabled: boolean;
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
            {pointsEnabled && (
              <span className="text-muted-foreground font-normal">· {item.points} b</span>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground mb-0.5">
            {ITEM_TYPE_LABELS[item.type].label}{pointsEnabled ? ` · ${item.points} b` : ""}
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
  pointsEnabled,
  onUpdateItem,
  onUpdateKey,
}: {
  item: WorksheetItem;
  answerKey: AnswerKeyEntry | null;
  pointsEnabled: boolean;
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

      <div className={pointsEnabled ? "grid grid-cols-2 gap-2" : ""}>
        {pointsEnabled && (
          <div>
            <Label className="text-xs">Body</Label>
            <Input
              type="number"
              min={0}
              max={10}
              value={item.points}
              onChange={(e) => onUpdateItem({ points: Number(e.target.value) || 0 })}
            />
            <div className="flex gap-1.5 mt-2">
              {[1, 2, 3, 5].map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={item.points === n ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs flex-1"
                  onClick={() => onUpdateItem({ points: n })}
                >
                  {n} {pointsLabel(n)}
                </Button>
              ))}
            </div>
          </div>
        )}
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

