import { BetaBadge } from "@/components/common/BetaBadge";
import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  Monitor, Plus, Trash2, ChevronDown, Save, Sun, Moon, Type, List, Image as ImageIcon,
  Table as TableIcon, Settings2, Undo2, Redo2, ZoomIn, ZoomOut, Copy, FileDown, Heading as HeadingIcon,
  Quote as QuoteIcon, StickyNote, BarChart3, Sigma, Video as VideoIcon, Music, Loader2, Bookmark,
  Wand2, Settings, Puzzle, ArrowLeft, ExternalLink, Gamepad2, Move, FileUp, ClipboardPaste, Paintbrush,
  ChevronLeft, ChevronRight, Sparkles,

} from "lucide-react";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


import { SLIDE_GAME_MODES } from "@/lib/game-slide-settings";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SingleBlockEditor } from "@/components/admin/BlockEditor";
import { useValueHistory } from "@/hooks/useSlidesHistory";
import SlideCanvas, { SLIDE_LAYOUTS, type SlideLayout } from "@/components/admin/SlideCanvas";
import { MediaPickerDialog } from "@/components/media/MediaPickerDialog";
import { AddSlideSheet } from "@/components/game/AddSlideSheet";
import { createDefaultBlock, type Block } from "@/lib/textbook-config";
import { SLIDE_BACKGROUND_COLORS } from "@/lib/slide-typography";
import ZoomZonesEditor from "@/components/admin/ZoomZonesEditor";
import { isZoomableSlide, type ZoomZone } from "@/lib/zoom-zones";
import {
  DEFAULT_BLOCK_FRAME, getBlockFrame,
  alignFrameToStage, fillStageFrame, alignFramesTogether, distributeFrames,
  makeGroupBlock, ungroupBlock, type AlignMode,
} from "@/lib/block-frame";

import { Switch } from "@/components/ui/switch";
import ImportPptxToPresentationDialog from "@/components/admin/ImportPptxToPresentationDialog";
import PresentationExportDialog from "@/components/admin/PresentationExportDialog";
import IconPickerDialog from "@/components/admin/IconPickerDialog";
import { applyThemeToSlides, getPresentationTheme, themeIdFromSlides } from "@/lib/presentation-themes";
import { LayoutTemplate, Shapes, Pencil, Eraser, Maximize2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SLIDE_TRANSITIONS, transitionFromSlides, applyTransitionToSlides, applyTransitionToSlide, type SlideTransition, type SlideTransitionConfig } from "@/lib/slide-transitions";
import { exportSlidesToPdf } from "@/lib/presentation-pdf-export";
import ActivitySettingsPanel from "@/components/presentation/ActivitySettingsPanel";
import ActivityCatalog from "@/components/presentation/ActivityCatalog";
import InsertActivityDialog, { type ActivityInsertTarget } from "@/components/presentation/InsertActivityDialog";
import InsertSlidesDialog from "@/components/presentation/InsertSlidesDialog";
import { presentationMissingReport } from "@/lib/activity-completeness";
import ShapePickerPopover from "@/components/admin/ShapePickerPopover";
import ColorPicker from "@/components/admin/ColorPicker";
import ActivityAppearanceControls from "@/components/admin/ActivityAppearanceControls";
import GradientPicker from "@/components/admin/GradientPicker";
import type { DrawingStroke } from "@/components/admin/SlideDrawingLayer";
import AiBlockTextButton from "@/components/admin/AiBlockTextButton";
import PresentationCompactFormatToolbar from "@/components/presentation/editor/PresentationCompactFormatToolbar";
import BlockAnimationPanel from "@/components/presentation/editor/BlockAnimationPanel";
import { slideClickAnimations } from "@/lib/slide-block-animations";
import { loadPresentationEditorPreferences, savePresentationEditorPreferences } from "@/lib/presentation-editor-preferences";
import { activityBlockToSlide } from "@/lib/plan-to-slides";
import { activityTypeLabel, applySlidePatch, buildAiActivitySpec, normalizePresentationSlides, syncSpecFromBlock } from "@/lib/presentation-activity";
import { buildPresetIntoSlide, canHostActivity } from "@/lib/presentation-activity-insert";
import { cloneStudioSlide } from "@/lib/presentation-activity-sources";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import MyLessonActivitiesList from "@/components/presentation/MyLessonActivitiesList";
import { ACTIVITY_PRESETS, type ActivityPreset } from "@/lib/activity-slide-presets";
import { DEFAULT_NEW_QUIZ_TIME_SEC } from "@/lib/live-timing";
import { markSlideEditedByTeacher, restoreSlideFromLesson } from "@/lib/presentation-merge";
import { attachLessonRef, readLessonRef } from "@/lib/presentation-lesson-ref";
import {
  deletePresentationSlides, duplicatePresentationSlides, isActivitySlide as slideContainsActivity,
  movePresentationSlidesToEdge, setPresentationSlidesHidden, type SlideEditResult,
} from "@/lib/presentation-slide-actions";

import {
  HelpCircle, Cloud, MessageSquare, Users2, KeyRound, SplitSquareHorizontal,
  Lock, LockOpen, RotateCcw, CheckCheck, ArrowLeftRight, Grid3X3,
} from "lucide-react";


import GameBackgroundPickerDialog from "@/components/game/GameBackgroundPickerDialog";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { persistSlideImageUrl } from "@/lib/slide-image-persist";
import PresentationTopBar from "@/components/presentation/editor/PresentationTopBar";
import PresentationLeftPanel, { type EditorLeftTab } from "@/components/presentation/editor/PresentationLeftPanel";
import PresentationThumbnails from "@/components/presentation/editor/PresentationThumbnails";
import SlideInsertMenu, { type SlideInsertKind } from "@/components/presentation/editor/SlideInsertMenu";
import SlideTransitionPopover from "@/components/presentation/editor/SlideTransitionPopover";
import SelectionPropertiesPanel from "@/components/presentation/editor/SelectionPropertiesPanel";
import { PRESENTATION_THEMES } from "@/lib/presentation-themes";
import { cloneTemplateSlides, PRESENTATION_TEMPLATES } from "@/lib/presentation-templates";
import PresentationTemplatesPanel from "@/components/presentation/PresentationTemplatesPanel";
import { Settings2 as PropertiesIcon } from "lucide-react";

export interface PresentationLessonRef {
  id?: string;
  title: string;
  textbookId?: string;
  subjectId?: string;
  grade?: number | string;
  topicSlug?: string;
  source?: string;
}


interface Props {
  presentationLesson: PresentationLessonRef | null;
  /**
   * Zdroj slidů. 'lesson' = klasická prezentace uložená u lekce (výchozí, zpětně kompatibilní),
   * 'standalone' = samostatná prezentace v tabulce teacher_presentations.
   */
  source?: { type: "lesson"; lessonId?: string } | { type: "standalone"; presentationId: string };
  pendingSlides: any[];
  /** Čerstvá verze z lekce pro okamžité obnovení ručně upraveného snímku. */
  generatedSlides?: any[];
  setPendingSlides: React.Dispatch<React.SetStateAction<any[]>>;
  editingSlideIndex: number;
  setEditingSlideIndex: (i: number) => void;
  onClose: () => void;
  onLaunch: (slides: any[]) => void;
  onSave?: (slides: any[]) => Promise<void>;
  hasSavedPresentation?: boolean;
  existingSession: { id: string; title: string } | null;
  onContinueExisting: () => void;
  onLaunchNew: () => void;
  onCloseExisting: () => void;
}

/** Prvek levého panelu „Vložit“. */
const InsertTile = ({
  icon: Icon, label, onClick,
}: { icon: any; label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="deck-insert-tile"
  >
    <Icon className="h-5 w-5" />
    <span className="leading-tight text-center">{label}</span>
  </button>
);

const BLOCK_TYPE_LABELS: Record<string, string> = {
  heading: "Nadpis",
  paragraph: "Text",
  bullet_list: "Odrážky",
  image: "Obrázek",
  table: "Tabulka",
  chart: "Graf",
  formula: "Rovnice",
  video: "Video",
  audio: "Zvuk",
  quote: "Citace",
  callout: "Box",
  shape: "Tvar",
};

/** Krátký popis bloku pro seznam v panelu. */
const blockLabel = (block: Block, index: number) => {
  const kind = BLOCK_TYPE_LABELS[block.type] || block.type;
  const raw = String(block.props?.text || block.props?.html || block.props?.caption || "");
  const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return `${index + 1}. ${kind}${text ? ` – ${text.slice(0, 24)}` : ""}`;
};

const stripHtml = (html: string) => String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export const PresentationEditorDialog = ({
  presentationLesson, source, pendingSlides, generatedSlides = [], setPendingSlides,
  editingSlideIndex, setEditingSlideIndex,
  onClose, onLaunch, onSave, hasSavedPresentation,
  existingSession, onContinueExisting, onLaunchNew, onCloseExisting,
}: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Neuložené změny + líná normalizace aktivit při otevření (nic se neukládá) ──
  const editorOpen = !!presentationLesson && pendingSlides.length > 0;
  const openKey = editorOpen ? `${presentationLesson?.id ?? ""}` : "";
  const baselineRef = useRef<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<null | { after?: () => void }>(null);
  const [pendingSlideDelete, setPendingSlideDelete] = useState<number[] | null>(null);
  useEffect(() => {
    if (!openKey) { baselineRef.current = null; return; }
    setSavedOnce(false);
    setSelectedSlideIndices([editingSlideIndex]);
    slideSelectionAnchorRef.current = editingSlideIndex;
    const normalized = normalizePresentationSlides(pendingSlides);
    if (normalized !== pendingSlides) setPendingSlides(normalized);
    baselineRef.current = JSON.stringify(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey]);
  const currentJson = useMemo(() => (editorOpen ? JSON.stringify(pendingSlides) : ""), [editorOpen, pendingSlides]);
  const isDirty = editorOpen && baselineRef.current !== null && baselineRef.current !== currentJson;
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
  /** Zavření editoru: při neuložených změnách se nejdřív zeptá. */
  const requestClose = (after?: () => void) => {
    if (isDirty) { setConfirmClose({ after }); return; }
    onClose();
    after?.();
  };

  /**
   * Obrázek z privátní knihovny učitele nejdřív zkopíruje do veřejného bucketu,
   * aby odkaz ve slidu nevypršel. Při chybě nic nevloží a ukáže toast.
   */
  const insertPersistentImage = async (
    url: string,
    item: any,
    apply: (finalUrl: string) => void,
  ) => {
    try {
      const finalUrl = await persistSlideImageUrl(url, item, user?.id);
      apply(finalUrl);
    } catch (e: any) {
      toast({
        title: "Obrázek se nepodařilo vložit",
        description: e?.message || "Zkuste to prosím znovu.",
        variant: "destructive",
      });
    }
  };

  const [darkPreview, setDarkPreview] = useState(true);
  const [addSlideOpen, setAddSlideOpen] = useState(false);
  /** Kam se vloží nový snímek z „Přidat snímek“ (null = na konec). */
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);
  const history = useValueHistory(pendingSlides, setPendingSlides);
  const [importPptxOpen, setImportPptxOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  /** Výběr prvků na plátně – pole ID (fáze 3: víceprvkový výběr). */
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [selectedSlideIndices, setSelectedSlideIndices] = useState<number[]>([0]);
  const [animationPreviewKey, setAnimationPreviewKey] = useState(0);
  const [animationPanelOpen, setAnimationPanelOpen] = useState(false);
  const slideSelectionAnchorRef = useRef(0);
  const selectedBlockId = selectedBlockIds[0] ?? null;
  const setSelectedBlockId = (id: string | null) => setSelectedBlockIds(id ? [id] : []);

  const [copiedBlock, setCopiedBlock] = useState<Block | null>(null);
  const [copiedStyle, setCopiedStyle] = useState<Record<string, unknown> | null>(null);

  const [exportingPdf, setExportingPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const [generatingActivity, setGeneratingActivity] = useState(false);
  const [sidebarSection, setSidebarSection] = useState<EditorLeftTab>("elements");
  const [initialLayout] = useState(() => loadPresentationEditorPreferences(typeof window === "undefined" ? null : window.localStorage, typeof window === "undefined" ? undefined : window.innerWidth));
  const [leftPanelOpen, setLeftPanelOpen] = useState(initialLayout.leftPanelOpen);
  const [propertiesOpen, setPropertiesOpen] = useState(initialLayout.propertiesOpen);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(initialLayout.thumbnailsOpen);
  const [activityCreatorOpen, setActivityCreatorOpen] = useState(true);
  const [insertActivityOpen, setInsertActivityOpen] = useState(false);
  const [insertSlidesOpen, setInsertSlidesOpen] = useState(false);
  const [activityInsertAtIndex, setActivityInsertAtIndex] = useState<number | null>(null);
  const [slidesInsertAtIndex, setSlidesInsertAtIndex] = useState<number | null>(null);
  const [templateInsertAtIndex, setTemplateInsertAtIndex] = useState<number | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState("#FDE047");
  const [drawWidth, setDrawWidth] = useState(3);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const pendingSlidesRef = useRef(pendingSlides);
  const toastRef = useRef(toast);
  pendingSlidesRef.current = pendingSlides;
  toastRef.current = toast;


  const currentSlide = pendingSlides[editingSlideIndex];
  const isStandalone = source?.type === "standalone";
  const linkedToLesson = !isStandalone && !!presentationLesson?.id;
  const themeId = themeIdFromSlides(pendingSlides);
  const theme = getPresentationTheme(themeId);

  // Při přepnutí slidu resetujeme zoom/pan zpět na autofit.
  useEffect(() => {
    setZoom("fit");
    setPan({ x: 0, y: 0 });
  }, [editingSlideIndex]);

  useEffect(() => {
    savePresentationEditorPreferences({ leftPanelOpen, propertiesOpen, thumbnailsOpen }, window.localStorage);
    setZoom("fit");
    setPan({ x: 0, y: 0 });
  }, [leftPanelOpen, propertiesOpen, thumbnailsOpen]);

  // Klávesové zkratky historie a Alt+M pro miniatury.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.altKey && key === "m") {
        e.preventDefault();
        setThumbnailsOpen((value) => !value);
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
      } else if (key === "y") {
        e.preventDefault();
        history.redo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [history]);

  const zoomPct = zoom === "fit" ? 100 : zoom;
  const stepZoom = (delta: number) =>
    setZoom((z) => Math.min(500, Math.max(25, (z === "fit" ? 100 : z) + delta)));


  const setThemeId = (next: string) => setPendingSlides(applyThemeToSlides(pendingSlides, next));
  const transition = transitionFromSlides(pendingSlides);
  const setTransition = (next: SlideTransition) =>
    setPendingSlides(applyTransitionToSlides(pendingSlides, next));
  const changeSlideTransition = (index: number, config: SlideTransitionConfig) => {
    setPendingSlides((current) => applyTransitionToSlide(current, index, config));
  };
  const applyTransitionEverywhere = (config: SlideTransitionConfig) => {
    setPendingSlides((current) => applyTransitionToSlides(current, config));
    toast({ title: "Přechod použit na celou prezentaci", description: "Styl, směr i délka se projeví po uložení a spuštění projekce." });
  };

  const isActivitySlide = currentSlide?.type === "activity" || (currentSlide as any)?.type === "studio_step";
  const [activityPanelOpen, setActivityPanelOpen] = useState(true);
  const [focusActivityFor, setFocusActivityFor] = useState<string | number | null>(null);
  const handlePrintActivity = async () => {
    if (!currentSlide) return;
    setExportingPdf(true);
    try {
      await exportSlidesToPdf([currentSlide], themeId, `${presentationLesson?.title || "prezentace"} – aktivita`);
      toast({ title: "List vytvořen", description: "Aktuální slide byl stažen jako PDF k tisku." });
    } catch (e: any) {
      toast({ title: "Tisk se nepodařil", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setExportingPdf(false);
    }
  };
  /** Spuštění: když aktivitám chybí obsah, učitel se dozví co a kde. */
  const launchWithCheck = () => {
    const missing = presentationMissingReport(pendingSlides);
    if (missing.length) {
      toast({
        title: "Některé aktivity nejsou hotové",
        description: `${missing.slice(0, 3).join("; ")}${missing.length > 3 ? " …" : ""}. Nedokončené aktivity se ve hře přeskočí nebo poběží bez bodů.`,
        variant: "destructive",
      });
    }
    onLaunch(pendingSlides);
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await exportSlidesToPdf(pendingSlides, themeId, presentationLesson?.title || "prezentace");
      toast({ title: "PDF vytvořeno", description: "Prezentace byla stažena jako PDF." });
    } catch (e: any) {
      toast({
        title: "Export do PDF se nepodařil",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setExportingPdf(false);
    }
  };

  // Nová prázdná prezentace → nabídni startovní šablonu.
  const isEmptyNewPresentation =
    !hasSavedPresentation &&
    pendingSlides.length === 1 &&
    !(pendingSlides[0]?.blocks || []).length &&
    !String(pendingSlides[0]?.projector?.body || "").trim();

  // Nová prezentace už neblokuje práci modálním oknem. Šablony jsou stále
  // dostupné jako čtvrtá záložka levého panelu.
  useEffect(() => {
    if (presentationLesson && isEmptyNewPresentation) setSidebarSection("templates");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationLesson?.title]);

  // Migrate legacy slides: if a slide has projector.body text but no blocks,
  // seed a paragraph block so the text becomes inline-editable in the canvas.
  useEffect(() => {
    if (!currentSlide) return;
    const hasBlocks = Array.isArray(currentSlide.blocks) && currentSlide.blocks.length > 0;
    const bodyText: string = currentSlide.projector?.body || "";
    if (!hasBlocks && bodyText.trim()) {
      const seeded = createDefaultBlock("paragraph");
      seeded.props = { ...seeded.props, text: bodyText };
      const wasClean = baselineRef.current === JSON.stringify(pendingSlides);
      const updated = [...pendingSlides];
      updated[editingSlideIndex] = {
        ...currentSlide,
        blocks: [seeded],
        projector: { ...currentSlide.projector, body: "" },
      };
      setPendingSlides(updated);
      // Automatický převod textu na blok není změna učitele – nevaruje při zavření.
      if (wasClean) baselineRef.current = JSON.stringify(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSlideIndex, currentSlide?.slideId]);

  // Při přepnutí snímku schovej plovoucí lištu.
  useEffect(() => {
    setSelectedBlockId(null);
  }, [editingSlideIndex]);

  // Klik mimo plátno (a mimo panel, lištu či její popovery) zruší výběr bloku.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        canvasWrapRef.current?.contains(target) ||
        target.closest("[data-slide-toolbar='true']") ||
        target.closest("[data-slide-sidebar='true']") ||
        target.closest(".deck-properties-panel") ||
        target.closest("[data-radix-popper-content-wrapper]")
      ) {
        return;
      }
      setSelectedBlockId(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);


  const updateSlide = (patch: any, options: { markEdited?: boolean } = {}) => {
    const updated = [...pendingSlides];
    // Blok aktivity na plátně a activitySpec (čte hra) se drží ve shodě.
    const next = applySlidePatch(updated[editingSlideIndex], patch);
    updated[editingSlideIndex] = options.markEdited === false
      ? next
      : markSlideEditedByTeacher(next, linkedToLesson);
    setPendingSlides(updated);
  };
  const updateProjector = (patch: any) => {
    updateSlide({ projector: { ...currentSlide?.projector, ...patch } });
  };
  const blocks: Block[] = ((currentSlide?.blocks || []) as Block[]);
  const setBlocks = (next: Block[], structural = false, deletedIds: string[] = []) => updateSlide({
    blocks: next,
    ...(structural ? {
      structureEditedByTeacher: true,
      deletedSourceBlockIds: Array.from(new Set([
        ...((currentSlide?.deletedSourceBlockIds || []) as string[]),
        ...deletedIds,
      ])),
    } : {}),
  });
  const addBlock = (type: Block["type"]) =>
    setBlocks([...blocks, { ...createDefaultBlock(type), editedByTeacher: true } as Block]);

  const moveBlock = (id: string, dir: "up" | "down") => {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0 || (blocks[i] as any).locked) return;
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next, true);
  };
  const deleteBlock = (id: string) => {
    const target = blocks.find((block) => block.id === id);
    if ((target as any)?.locked) {
      toast({ title: "Prvek je zamčený", description: "Nejprve ho odemkněte v panelu Vlastnosti." });
      return;
    }
    setBlocks(blocks.filter((b) => b.id !== id), true, [id]);
  };
  /**
   * Úprava jednoho bloku. Pracuje funkčně nad `pendingSlides`, takže dvě
   * změny ve stejném ticku (např. commit textu při blur + povýšení do frame)
   * se nepřepíší.
   */
  const updateBlock = (id: string, patch: any) => {
    setPendingSlides((prev) => {
      const slide = prev[editingSlideIndex];
      if (!slide) return prev;
      const nextBlocks = ((slide.blocks || []) as Block[]).map((b) => {
        if (b.id !== id) return b;
        if ((b as any).locked && (typeof patch === "function" || Object.keys(patch).some((key) => key !== "locked"))) return b;
        const next = typeof patch === "function" ? patch(b) : { ...b, ...patch };
        // Ručně upravený blok se při přegenerování z lekce nepřepíše.
        return { ...next, editedByTeacher: true } as Block;
      });
      const updated = [...prev];
      updated[editingSlideIndex] = markSlideEditedByTeacher(syncSpecFromBlock({ ...slide, blocks: nextBlocks }), linkedToLesson);
      return updated;
    });
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

  /* ── ČÁST 1 – kopírování bloku (Ctrl+C / Ctrl+V styl) ─────────────── */
  const copyBlock = () => {
    if (!selectedBlock) return;
    setCopiedBlock(structuredClone(selectedBlock));
    toast({ title: "Blok zkopírován", description: "Vložte ho klávesou Ctrl+V nebo tlačítkem „Vložit kopii“." });
  };

  const pasteBlock = () => {
    if (!copiedBlock) return;
    const clone: any = structuredClone(copiedBlock);
    clone.id = crypto.randomUUID();
    const frame = getBlockFrame(clone);
    if (frame) clone.frame = { ...frame, x: frame.x + 5, y: frame.y + 5 };
    const maxZ = blocks.reduce(
      (m: number, b: Block) => Math.max(m, typeof b.zIndex === "number" ? b.zIndex : 0),
      0,
    );
    clone.zIndex = (typeof copiedBlock.zIndex === "number" ? copiedBlock.zIndex : maxZ) + 1;
    clone.editedByTeacher = true;
    setBlocks([...blocks, clone], true);

    setSelectedBlockId(clone.id);
  };

  /* ── ČÁST 2 – kopírování stylu (štětec) ───────────────────────────── */
  const STYLE_KEYS = [
    "fontSize", "fontFamily", "color", "textColor", "align", "alignment", "lineHeight",
    "bold", "italic", "highlightColor", "backgroundOverride", "iconColor",
    "fillColor", "strokeColor", "strokeWidth", "animation", "gradient", "fillGradient",
  ] as const;
  const TEXT_ONLY_KEYS = new Set(["fontSize", "fontFamily", "align", "lineHeight", "bold", "italic", "highlightColor"]);
  const COLOR_KEYS = new Set(["fillColor", "strokeColor", "strokeWidth", "iconColor", "color", "textColor"]);
  const TEXT_TYPES = new Set(["heading", "paragraph", "callout", "quote", "bullet_list", "summary", "two_column", "formula"]);

  const copyStyle = () => {
    if (!selectedBlock) return;
    const src = (selectedBlock.props || {}) as Record<string, unknown>;
    const picked: Record<string, unknown> = {};
    for (const key of STYLE_KEYS) {
      if (src[key] !== undefined && src[key] !== null) picked[key] = src[key];
    }
    if (Object.keys(picked).length === 0) {
      toast({ title: "Blok nemá vlastní styl", description: "Nastavte nejdřív např. barvu nebo velikost písma.", variant: "destructive" });
      return;
    }
    setCopiedStyle(picked);
    toast({ title: "Styl zkopírován", description: "Klikněte na blok, na který se má styl použít." });
  };

  /** Aplikuje zkopírovaný styl na blok – jen props kompatibilní s jeho typem. */
  const applyCopiedStyle = (targetId: string) => {
    const style = copiedStyle;
    if (!style) return;
    const target = blocks.find((b) => b.id === targetId);
    if (!target) return;
    const isText = TEXT_TYPES.has(target.type);
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(style)) {
      if (TEXT_ONLY_KEYS.has(key) && !isText) continue;
      if (target.type === "shape" && !COLOR_KEYS.has(key) && key !== "animation") continue;
      patch[key] = value;
    }
    if (Object.keys(patch).length === 0) {
      toast({ title: "Styl nelze použít", description: "Cílový blok nepodporuje žádnou ze zkopírovaných vlastností." });
    } else {
      updateBlock(targetId, (b: Block) => ({ ...b, props: { ...b.props, ...patch } }));
      toast({ title: "Styl použit" });
    }
    setCopiedStyle(null);
  };

  /** Výběr bloku na plátně – při aktivním štětci styl hned aplikuje. */
  const handleSelectBlock = (id: string | null, opts?: { additive?: boolean }) => {
    if (id && copiedStyle && id !== selectedBlockId) {
      applyCopiedStyle(id);
    }
    if (id && opts?.additive) {
      setSelectedBlockIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
      return;
    }
    // Klik na už vybraný prvek uvnitř většího výběru výběr nezruší.
    if (id && selectedBlockIds.length > 1 && selectedBlockIds.includes(id)) return;
    setSelectedBlockId(id);
    if (id) setPropertiesOpen(true);
  };

  /* ── FÁZE 2 + 3 – zarovnání, rozmístění a skupiny ────────────────── */

  /** Rámce vybraných volně umístěných prvků (v pořadí výběru). */
  const selectedFramed = selectedBlockIds
    .map((id) => blocks.find((b) => b.id === id))
    .filter((b): b is Block => !!b && !!getBlockFrame(b) && !(b as any).locked);

  const alignSelectedToStage = (mode: AlignMode) => {
    const target = selectedFramed[0];
    const frame = target && getBlockFrame(target);
    if (!target || !frame) return;
    updateBlock(target.id, (b: Block) => ({ ...b, frame: alignFrameToStage(frame, mode) }));
  };

  const fillStageWithSelected = () => {
    const target = selectedFramed[0];
    if (!target) return;
    updateBlock(target.id, (b: Block) => ({ ...b, frame: fillStageFrame() }));
  };

  const alignSelectionTogether = (mode: AlignMode) => {
    if (selectedFramed.length < 2) return;
    const frames = selectedFramed.map((b) => getBlockFrame(b)!);
    const next = alignFramesTogether(frames, mode);
    selectedFramed.forEach((b, i) => updateBlock(b.id, (prev: Block) => ({ ...prev, frame: next[i] })));
  };

  const distributeSelection = (axis: "h" | "v") => {
    if (selectedFramed.length < 3) {
      toast({
        title: "Rozmístění potřebuje 3 prvky",
        description: "Vyberte alespoň tři prvky – krajní zůstanou na místě.",
      });
      return;
    }
    const frames = selectedFramed.map((b) => getBlockFrame(b)!);
    const next = distributeFrames(frames, axis);
    selectedFramed.forEach((b, i) => updateBlock(b.id, (prev: Block) => ({ ...prev, frame: next[i] })));
  };

  /** Spojí vybrané prvky do jedné skupiny. */
  const groupSelection = () => {
    if (selectedFramed.length < 2) return;
    const ids = new Set(selectedFramed.map((b) => b.id));
    const group = makeGroupBlock(selectedFramed, crypto.randomUUID());
    setBlocks([...blocks.filter((b) => !ids.has(b.id)), { ...group, editedByTeacher: true } as Block], true);
    setSelectedBlockId(group.id);
    toast({ title: "Prvky spojeny", description: "Skupina se teď posouvá a mění velikost jako jeden celek." });
  };

  /** Rozpustí vybranou skupinu zpět na jednotlivé prvky. */
  const ungroupSelection = () => {
    const group = selectedFramed[0];
    if (!group || group.type !== ("group" as Block["type"])) return;
    const parts = ungroupBlock(group) as Block[];
    if (!parts.length) return;
    setBlocks([...blocks.filter((b) => b.id !== group.id), ...parts.map((p) => ({ ...p, editedByTeacher: true }))], true);
    setSelectedBlockIds(parts.map((p) => p.id));
    toast({ title: "Skupina rozdělena" });
  };

  /** Smaže všechny vybrané prvky. */
  const deleteSelection = () => {
    if (!selectedBlockIds.length) return;
    const ids = new Set(selectedBlockIds.filter((id) => !(blocks.find((block) => block.id === id) as any)?.locked));
    if (!ids.size) {
      toast({ title: "Prvky jsou zamčené", description: "Nejprve je odemkněte v panelu Vlastnosti." });
      return;
    }
    setBlocks(blocks.filter((b) => !ids.has(b.id)), true, [...ids]);
    setSelectedBlockIds((prev) => prev.filter((id) => !ids.has(id)));
  };

  /**
   * Klávesové zkratky na plátně: Delete/Backspace smaže vybrané prvky,
   * Ctrl/Cmd+C kopíruje a Ctrl/Cmd+V vloží kopii. Když uživatel právě píše
   * (input, textarea, contenteditable), zkratky se ignorují.
   */
  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el || typeof el.closest !== "function") return false;
      if (el.isContentEditable || el.closest('[contenteditable="true"]')) return true;
      return !!el.closest("input, textarea, select, [role='textbox']");
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const meta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (!meta && (e.key === "Delete" || e.key === "Backspace")) {
        if (!selectedBlockIds.length) return;
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (meta && key === "c") {
        if (!selectedBlockId) return;
        e.preventDefault();
        copyBlock();
        return;
      }
      if (meta && key === "v") {
        if (!copiedBlock) return;
        e.preventDefault();
        pasteBlock();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlockIds, blocks, copiedBlock, editingSlideIndex]);



  /** Přesun je pouze rozdělaná změna. Trvale se zapíše až učitelovým Uložit. */
  const moveSlide = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= pendingSlides.length || to >= pendingSlides.length) return;
    const updated = [...pendingSlides];
    const [moved] = updated.splice(from, 1);
    if (!moved) return;
    updated.splice(to, 0, moved);
    setPendingSlides(attachLessonRef(updated, readLessonRef(pendingSlides)));
    setEditingSlideIndex(to);
    setSelectedSlideIndices([to]);
    slideSelectionAnchorRef.current = to;
    setSelectedBlockId(null);
  };

  const selectSlide = (index: number, event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => {
    if (index < 0 || index >= pendingSlides.length) return;
    setTemplateInsertAtIndex(null);
    setEditingSlideIndex(index);
    setSelectedBlockId(null);
    if (event?.shiftKey) {
      const anchor = slideSelectionAnchorRef.current;
      const from = Math.min(anchor, index);
      const to = Math.max(anchor, index);
      setSelectedSlideIndices(Array.from({ length: to - from + 1 }, (_, offset) => from + offset));
      return;
    }
    slideSelectionAnchorRef.current = index;
    if (event?.ctrlKey || event?.metaKey) {
      setSelectedSlideIndices((previous) => previous.includes(index)
        ? previous.filter((item) => item !== index)
        : [...previous, index].sort((a, b) => a - b));
      return;
    }
    setSelectedSlideIndices([index]);
  };

  const applySlideEdit = (result: SlideEditResult | null) => {
    if (!result) return false;
    setPendingSlides(result.slides);
    setEditingSlideIndex(result.activeIndex);
    setSelectedSlideIndices(result.selectedIndices);
    slideSelectionAnchorRef.current = result.activeIndex;
    setSelectedBlockId(null);
    return true;
  };

  /** Vložení snímků na konkrétní pozici (index = kam se vloží první z nich). */
  const insertSlidesAt = (index: number, newSlides: any[]) => {
    if (!newSlides.length) return;
    const at = Math.max(0, Math.min(index, pendingSlides.length));
    const updated = [...pendingSlides];
    updated.splice(at, 0, ...newSlides);
    setPendingSlides(updated);
    setEditingSlideIndex(at);
    setSelectedSlideIndices([at]);
    slideSelectionAnchorRef.current = at;
    setSelectedBlockId(null);
  };

  /** Otevře výběr layoutu s předvolenou pozicí vložení. */
  const openAddSlideAt = (index: number | null) => {
    setInsertAtIndex(index);
    setAddSlideOpen(true);
  };

  /** Akční dvojice mezi miniatury používá stávající editory a vkládá přesně na zvolenou pozici. */
  const insertFromGap = (kind: SlideInsertKind, index: number) => {
    if (kind === "blank") {
      const blank = PRESENTATION_TEMPLATES.find((template) => template.id === "blank")?.build() || [];
      insertSlidesAt(index, cloneTemplateSlides(blank));
      toast({ title: "Prázdný slide vložen", description: "Změna je zatím pouze v rozdělané prezentaci." });
      return;
    }
    if (kind === "template") {
      setTemplateInsertAtIndex(index);
      setSidebarSection("templates");
      setLeftPanelOpen(true);
      return;
    }
    if (kind === "activity") {
      setActivityInsertAtIndex(index);
      setActivityTarget("new");
      setInsertActivityOpen(true);
      return;
    }
    setSlidesInsertAtIndex(index);
    setInsertSlidesOpen(true);
  };


  /** Po vložení aktivity se rovnou otevře její editor (pravý panel) s kurzorem v otázce. */
  const openActivityEditor = (slide: any, index: number) => {
    setActivityPanelOpen(true);
    setPropertiesOpen(true);
    setFocusActivityFor(slide?.slideId ?? index);
  };

  /** ČÁST 4a – vložení předpřipravené aktivity za aktuální slide. */
  const [activityTarget, setActivityTarget] = useState<"slide" | "new">("slide");
  const insertBuiltActivity = (built: any, label: string, target: ActivityInsertTarget = activityTarget) => {
    if (target === "slide" && currentSlide && canHostActivity(currentSlide)) {
      // Aktivita jako prvek aktuálního slidu – texty a obrázky slidu zůstanou.
      const updated = [...pendingSlides];
      updated[editingSlideIndex] = markSlideEditedByTeacher(buildPresetIntoSlide(currentSlide, built), linkedToLesson);
      setPendingSlides(updated);
      setSelectedBlockId(null);
      openActivityEditor(updated[editingSlideIndex], editingSlideIndex);
      toast({ title: "Aktivita přidána", description: `„${label}" je teď součástí tohoto slidu.` });
      return;
    }
    const updated = [...pendingSlides];
    const at = activityInsertAtIndex ?? editingSlideIndex + 1;
    updated.splice(at, 0, built);
    setPendingSlides(updated);
    setEditingSlideIndex(at);
    setSelectedSlideIndices([at]);
    slideSelectionAnchorRef.current = at;
    setActivityInsertAtIndex(null);
    setSelectedBlockId(null);
    openActivityEditor(built, at);
    toast({
      title: "Aktivita přidána",
      description: target === "slide"
        ? `Slide už má obsah nebo aktivitu, „${label}" je proto na novém slidu, aby se v promítání nic neztratilo.`
        : `„${label}" byla vložena jako nový slide.`,
    });
  };
  const insertActivityPreset = (preset: ActivityPreset) => insertBuiltActivity(preset.build(), preset.label);


  /** B3 – dogenerování interaktivní aktivity z textového slidu pomocí AI. */
  const generateActivityFromSlide = async () => {
    if (!currentSlide) return;
    const headline = String(currentSlide.projector?.headline || "").trim();
    const bodyText = [
      String(currentSlide.projector?.body || ""),
      ...blocks.map((b: any) => stripHtml(b?.props?.text || b?.props?.html || "")),
    ].filter(Boolean).join(" ").slice(0, 1200);
    if (!headline && !bodyText) {
      toast({ title: "Slide nemá obsah", description: "Doplňte nadpis nebo text, ze kterého se aktivita vytvoří.", variant: "destructive" });
      return;
    }
    setGeneratingActivity(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-mcq", {
        body: {
          topic: headline || presentationLesson?.title || "Téma hodiny",
          keywords: [headline, bodyText].filter(Boolean),
          difficulty: "střední",
        },
      });
      if (error) throw error;
      const question = String((data as any)?.question || headline);
      const options: string[] = Array.isArray((data as any)?.options) ? (data as any).options : [];
      const correctIndex = Number((data as any)?.correctIndex ?? 0);
      if (options.length < 2) throw new Error("AI nevrátila dost možností odpovědí.");

      const built = buildAiActivitySpec(
        String((currentSlide as any).planActivityKind ?? ""),
        { question, options, correctIndex },
        (currentSlide as any).activitySpec?.timeLimitSec ?? DEFAULT_NEW_QUIZ_TIME_SEC,
      );
      updateSlide({
        type: "activity",
        projector: { ...currentSlide.projector, headline: question },
        device: { ...currentSlide.device, instructions: built.instructions },
        activitySpec: built.spec,
        ai_generated: true,
      });
      if (built.note) toast({ title: "Upozornění k aktivitě", description: built.note });
      toast({ title: "Aktivita vytvořena", description: "Zkontrolujte prosím obsah vygenerovaný AI." });
    } catch (e: any) {
      toast({
        title: "Dogenerování aktivity se nepodařilo",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setGeneratingActivity(false);
    }
  };

  /** ČÁST 2 – URL zpět (na lekci nebo na seznam samostatných prezentací). */
  const lessonBackUrl = (() => {
    if (isStandalone) return "/ucitel/prezentace";
    const l = presentationLesson;
    if (!l) return null;
    if (l.textbookId) return `/ucitel/ucebnice/${l.textbookId}/lekce`;
    if (l.subjectId && l.grade && l.topicSlug) {
      return `/ucebnice/${l.subjectId}/${l.grade}/${l.topicSlug}${l.id ? `/${l.id}` : ""}`;
    }
    return null;
  })();

  /** ČÁST 3 – vložení vlastní aktivity z lekce přímo do editované prezentace. */
  const insertActivitySlide = (block: any, label: string) => {
    if (activityTarget === "slide" && currentSlide && canHostActivity(currentSlide)) {
      const updated = [...pendingSlides];
      const asSlide = activityBlockToSlide(block);
      updated[editingSlideIndex] = markSlideEditedByTeacher(buildPresetIntoSlide(currentSlide, asSlide, { withBlock: true }), linkedToLesson);
      setPendingSlides(updated);
      setSelectedBlockId(null);
      toast({ title: "Aktivita vložena", description: `„${label}" je teď součástí tohoto slidu.` });
      return;
    }
    const slide = activityBlockToSlide(block);
    const updated = [...pendingSlides];
    updated.splice(editingSlideIndex + 1, 0, slide);
    setPendingSlides(updated);
    setEditingSlideIndex(editingSlideIndex + 1);
    setSelectedBlockId(null);
    toast({ title: "Aktivita vložena", description: `„${label}" byla přidána jako nový slide.` });
  };

  /** Aktivita ze Studia – kopie slidu (originál ve Studiu se nemění), vždy jako nový slide. */
  const insertStudioSlide = (slide: any, label: string) => {
    const updated = [...pendingSlides];
    const copy = cloneStudioSlide(slide);
    updated.splice(editingSlideIndex + 1, 0, copy);
    setPendingSlides(updated);
    setEditingSlideIndex(editingSlideIndex + 1);
    setSelectedBlockId(null);
    openActivityEditor(copy, editingSlideIndex + 1);
    toast({ title: "Aktivita ze Studia vložena", description: `„${label}" byla přidána jako nový slide.` });
  };

  const handleSave = async () => {
    if (!onSave || saving) return;
    setSaving(true);
    try {
      await onSave(pendingSlides);
      baselineRef.current = JSON.stringify(pendingSlides);
      setSavedOnce(true);
      setConfirmClose(null);
      const missing = presentationMissingReport(pendingSlides);
      toast(missing.length
        ? { title: "Uloženo – aktivity nejsou hotové", description: `${missing.slice(0, 3).join("; ")}${missing.length > 3 ? " …" : ""}.` }
        : { title: "Prezentace uložena", description: "Všechny změny jsou uložené." });
    } catch (e: any) {
      toast({ title: "Uložení se nepodařilo", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const duplicateSlides = (indices: number[]) => {
    const result = duplicatePresentationSlides(pendingSlides, indices, editingSlideIndex);
    if (!applySlideEdit(result)) return;
    toast({ title: indices.length > 1 ? "Slidy duplikovány" : "Slide duplikován", description: "Kopie jsou zatím pouze v rozdělané prezentaci." });
  };

  const duplicateCurrentSlide = () => duplicateSlides([editingSlideIndex]);

  const performDeleteSlides = (selected: number[]) => {
    const activityCount = selected.filter((index) => slideContainsActivity(pendingSlides[index])).length;
    const previousActive = editingSlideIndex;
    const previousSelection = selectedSlideIndices;
    const result = deletePresentationSlides(pendingSlides, selected, editingSlideIndex);
    if (!applySlideEdit(result)) return;
    toast({
      title: selected.length > 1 ? `${selected.length} ${selected.length < 5 ? "slidy" : "slidů"} smazáno` : activityCount ? "Slide s aktivitou smazán" : "Slide smazán",
      description: activityCount
        ? `Odebraný obsah zahrnoval ${activityCount === 1 ? "aktivitu" : "aktivity"}. Včetně ní ji můžete vrátit zpět.`
        : "Změna je zatím jen v rozdělané prezentaci.",
      action: <ToastAction altText="Vrátit smazání slidů" onClick={() => {
        history.undo();
        setEditingSlideIndex(previousActive);
        setSelectedSlideIndices(previousSelection);
        slideSelectionAnchorRef.current = previousActive;
      }}>Zpět</ToastAction>,
    });
  };

  const deleteSlides = (indices: number[]) => {
    const selected = [...new Set(indices)].filter((index) => index >= 0 && index < pendingSlides.length);
    if (!selected.length) return;
    if (pendingSlides.length <= 1 || selected.length >= pendingSlides.length) {
      toast({ title: "Poslední slide musí zůstat", description: "Přidejte nejprve nový slide, nebo upravte stávající.", variant: "destructive" });
      return;
    }
    setPendingSlideDelete(selected);
  };

  const deleteCurrentSlide = () => deleteSlides([editingSlideIndex]);

  const moveSlidesToEdge = (indices: number[], edge: "start" | "end") => {
    if (!applySlideEdit(movePresentationSlidesToEdge(pendingSlides, indices, edge, editingSlideIndex))) return;
    toast({ title: edge === "start" ? "Slidy přesunuty na začátek" : "Slidy přesunuty na konec" });
  };

  const toggleSlidesHidden = (indices: number[]) => {
    const hide = !indices.every((index) => pendingSlides[index]?.hiddenInPresentation === true);
    if (!applySlideEdit(setPresentationSlidesHidden(pendingSlides, indices, hide, editingSlideIndex))) return;
    toast({ title: hide ? "Skryto při promítání" : "Znovu zobrazeno při promítání", description: "Obsah zůstává v editoru a změna se uloží až tlačítkem Uložit." });
  };

  const aiActivityButton = (
    <div className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-2">
      <Button
        size="sm"
        variant="outline"
        className="w-full gap-1.5 text-xs"
        onClick={generateActivityFromSlide}
        disabled={generatingActivity || currentSlide?.type === "activity"}
      >
        {generatingActivity ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
        Dogenerovat aktivitu (AI)
      </Button>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {currentSlide?.type === "activity"
          ? "Tento slide už aktivitu obsahuje."
          : "Bezlai z obsahu slidu vytvoří interaktivní aktivitu. Výstup prosím zkontrolujte."}
      </p>
    </div>
  );

  return (
    <>
      <Dialog open={!!presentationLesson && pendingSlides.length > 0} onOpenChange={(open) => { if (!open) requestClose(); }}>
        <DialogContent className="deck-editor-shell flex h-[100dvh] w-[100vw] max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0">
          <DialogTitle className="sr-only">Editor prezentace – {presentationLesson?.title}</DialogTitle>
          <DialogDescription className="sr-only">Úprava slidů prezentace: vzhled, obsah a spuštění živé prezentace.</DialogDescription>

          <PresentationTopBar
            title={presentationLesson?.title || "Prezentace"}
            linkedLessonTitle={linkedToLesson ? presentationLesson?.title : null}
            dirty={isDirty || (!hasSavedPresentation && !savedOnce)}
            saving={saving}
            exporting={exportingPdf}
            canSave={!!onSave}
            onBack={lessonBackUrl ? () => requestClose(() => navigate(lessonBackUrl)) : () => requestClose()}
            onImport={() => setImportPptxOpen(true)}
            onExport={() => setExportOpen(true)}
            onAssign={() => toast({ title: "Zadání žákům připravujeme", description: "Prezentaci zatím můžete spustit živě nebo exportovat do PDF." })}
            onSave={() => void handleSave()}
            onLaunch={launchWithCheck}
          />

          {currentSlide && (
            <div className="deck-editor-workspace">
              <PresentationLeftPanel active={sidebarSection} onChange={setSidebarSection} open={leftPanelOpen} onToggle={() => setLeftPanelOpen((v) => !v)}>
                {sidebarSection === "elements" && (
                  <div className="space-y-5">
                    <section>
                      <h2 className="mb-3 font-deck-heading text-sm uppercase tracking-wide text-deck-violet-deep">Přidat prvek</h2>
                      <div className="grid grid-cols-3 gap-2">
                        <InsertTile icon={HeadingIcon} label="Nadpis" onClick={() => addBlock("heading")} />
                        <InsertTile icon={Type} label="Text" onClick={() => addBlock("paragraph")} />
                        <InsertTile icon={List} label="Odrážky" onClick={() => addBlock("bullet_list")} />
                        <MediaPickerDialog
                          imageOnly
                          onPickMany={async (picked) => {
                            const targetSlideId = currentSlide?.slideId;
                            const added: Block[] = [];
                            for (const { url, item } of picked) {
                              const finalUrl = await persistSlideImageUrl(url, item, user?.id);
                              const newBlock = createDefaultBlock("image");
                              newBlock.props = { ...newBlock.props, url: finalUrl };
                              added.push(newBlock);
                            }
                            const latest = pendingSlidesRef.current;
                            const index = latest.findIndex((slide) => slide.slideId === targetSlideId);
                            if (index < 0) throw new Error("Snímek již není dostupný.");
                            const slide = latest[index];
                            const next = [...latest];
                            next[index] = markSlideEditedByTeacher({ ...slide, blocks: [...(slide.blocks || []), ...added], structureEditedByTeacher: true }, linkedToLesson);
                            setPendingSlides(next);
                          }}
                          onPick={(url, item) => {
                            void insertPersistentImage(url, item, (finalUrl) => {
                              const newBlock = createDefaultBlock("image");
                              newBlock.props = { ...newBlock.props, url: finalUrl };
                              setBlocks([...blocks, newBlock]);
                            });
                          }}
                          trigger={<button type="button" className="deck-insert-tile"><ImageIcon className="h-5 w-5" /><span>Obrázek</span></button>}
                        />
                        <ShapePickerPopover
                          onPick={(props) => {
                            const newBlock = createDefaultBlock("shape");
                            newBlock.props = { ...newBlock.props, ...props };
                            (newBlock as any).frame = { x: 20, y: 20, w: 60, h: 40 };
                            setBlocks([...blocks, newBlock]);
                          }}
                          trigger={<button type="button" className="deck-insert-tile"><Shapes className="h-5 w-5" /><span>Tvar</span></button>}
                        />
                        <InsertTile icon={TableIcon} label="Tabulka" onClick={() => addBlock("table")} />
                        <InsertTile icon={BarChart3} label="Graf" onClick={() => addBlock("chart")} />
                        <InsertTile icon={VideoIcon} label="Video" onClick={() => addBlock("video")} />
                        <IconPickerDialog
                          themeId={themeId}
                          onPick={({ name, color }) => {
                            const newBlock = createDefaultBlock("image");
                            newBlock.props = { ...newBlock.props, url: "", icon: name, iconColor: color, width: "medium" };
                            setBlocks([...blocks, newBlock]);
                          }}
                          trigger={<button type="button" className="deck-insert-tile"><Puzzle className="h-5 w-5" /><span>Ikona</span></button>}
                        />
                      </div>
                    </section>

                    <Collapsible>
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-deck-line px-3 py-2 text-xs font-semibold text-deck-violet-deep">
                        Další prvky a akce <ChevronDown className="h-4 w-4" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-2 pt-2">
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
                          <InsertTile icon={StickyNote} label="Box" onClick={() => addBlock("callout")} />
                          <InsertTile icon={QuoteIcon} label="Citace" onClick={() => addBlock("quote")} />
                          <InsertTile icon={Sigma} label="Rovnice" onClick={() => addBlock("formula")} />
                          <InsertTile icon={Music} label="Zvuk" onClick={() => addBlock("audio")} />
                        </div>
                        <AiBlockTextButton
                          block={selectedBlock}
                          headline={currentSlide.projector?.headline || ""}
                          lessonTitle={presentationLesson?.title || ""}
                          onAccept={(text) => {
                            if (!selectedBlockId) return;
                            updateBlock(selectedBlockId, (b: Block) => ({ ...b, props: { ...b.props, text: b.type === "heading" ? text : `<p>${text}</p>` } }));
                          }}
                        />
                        <div className="flex flex-col gap-2">
                          <Button variant="outline" size="sm" className="h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left leading-tight" disabled={!copiedBlock} onClick={pasteBlock}><ClipboardPaste className="mr-1 h-3.5 w-3.5 shrink-0" />Vložit kopii</Button>
                          <Button variant="outline" size="sm" className="h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left leading-tight" disabled={!copiedStyle || !selectedBlockId} onClick={() => selectedBlockId && applyCopiedStyle(selectedBlockId)}><Paintbrush className="mr-1 h-3.5 w-3.5 shrink-0" />Vložit styl</Button>
                          <Button variant="outline" size="sm" className="h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left leading-tight" onClick={() => openAddSlideAt(0)}><Plus className="mr-1 h-3.5 w-3.5 shrink-0" />Slide na začátek</Button>
                          <Button variant="outline" size="sm" className="h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left leading-tight" onClick={duplicateCurrentSlide}><Copy className="mr-1 h-3.5 w-3.5 shrink-0" />Duplikovat slide</Button>
                        </div>
                        {pendingSlides.length > 1 && <Button variant="outline" size="sm" className="h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left leading-tight text-destructive" onClick={deleteCurrentSlide}><Trash2 className="mr-1 h-3.5 w-3.5 shrink-0" />Smazat aktuální slide</Button>}
                      </CollapsibleContent>
                    </Collapsible>

                    <section className="space-y-3 border-t border-deck-line pt-4">
                      <h2 className="font-deck-heading text-sm uppercase tracking-wide text-deck-violet-deep">Pozadí a motiv</h2>
                      <div className="grid grid-cols-3 gap-2">
                        {PRESENTATION_THEMES.map((item) => (
                          <button key={item.id} type="button" onClick={() => setThemeId(item.id)} aria-label={`Použít motiv ${item.name}`} aria-pressed={themeId === item.id} className={`overflow-hidden rounded-lg border-2 ${themeId === item.id ? "border-deck-violet" : "border-deck-line"}`}>
                            <span className="flex h-12 items-end p-1.5 text-[9px] font-semibold text-deck-on-violet" style={{ background: item.backgroundStyle }}>{item.name}</span>
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2" aria-label="Barva pozadí slidu">
                        {SLIDE_BACKGROUND_COLORS.map((color) => <button key={color} type="button" aria-label={`Pozadí ${color}`} onClick={() => updateSlide({ backgroundOverride: { color } })} className="h-8 w-8 rounded-full border border-deck-line" style={{ backgroundColor: color }} />)}
                      </div>
                    </section>
                  </div>
                )}

                {sidebarSection === "activities" && (
                  <div className="space-y-4">
                    <Button className="h-11 w-full rounded-xl bg-deck-violet text-deck-on-violet hover:bg-deck-violet-deep" onClick={() => setInsertActivityOpen(true)}>
                      <Plus className="mr-2 h-5 w-5" /> Vložit aktivitu
                    </Button>
                    <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => setActivityCreatorOpen((v) => !v)} aria-expanded={activityCreatorOpen}>
                      <Puzzle className="mr-2 h-5 w-5" /> Vytvořit novou aktivitu
                    </Button>
                    <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => setInsertSlidesOpen(true)}><Copy className="mr-2 h-4 w-4" />Vložit slidy z lekce / prezentace</Button>
                    <div role="radiogroup" aria-label="Kam vložit aktivitu" className="grid grid-cols-2 gap-1 rounded-lg bg-deck-soft p-1">
                      {([["slide", "Do tohoto slidu"], ["new", "Jako nový slide"]] as const).map(([value, label]) => (
                        <button key={value} type="button" role="radio" aria-checked={activityTarget === value} onClick={() => setActivityTarget(value)} className={`rounded-md px-2 py-2 text-[11px] font-semibold ${activityTarget === value ? "bg-deck-violet text-deck-on-violet" : "text-deck-violet-deep"}`}>{label}</button>
                      ))}
                    </div>
                    {activityCreatorOpen && <ActivityCatalog compact onPick={insertActivityPreset} />}
                    <section className="space-y-2 border-t border-deck-line pt-4">
                      <h2 className="font-deck-heading text-sm uppercase tracking-wide text-deck-violet-deep">Oblíbené typy</h2>
                      {[
                        ["mcq", "Kvíz", "Otázka s výběrem odpovědi", HelpCircle],
                        ["true_false", "Pravda / nepravda", "Rychlé posouzení tvrzení", CheckCheck],
                        ["wall", "Zeď a slovní mrak", "Společné odpovědi celé třídy", MessageSquare],
                        ["matching", "Dvojice a třídění", "Spojování pojmů a kategorií", ArrowLeftRight],
                        ["crossword", "Křížovka a pexeso", "Procvičení pojmů hravou formou", Grid3X3],
                        ["escape", "Úniková hra", "Série hádanek a zámků", KeyRound],
                      ].map(([presetId, label, description, Icon]: any) => {
                        const preset = ACTIVITY_PRESETS.find((item) => item.id === presetId);
                        return preset && <button key={presetId} type="button" onClick={() => insertActivityPreset(preset)} className="flex w-full items-center gap-3 rounded-xl border border-deck-line p-3 text-left hover:border-deck-teal hover:bg-deck-cream"><Icon className="h-5 w-5 shrink-0 text-deck-violet" /><span><span className="block text-xs font-semibold">{label}</span><span className="block text-[11px] text-deck-muted">{description}</span></span></button>;
                      })}
                    </section>
                    <Button variant="outline" className="w-full" onClick={() => window.open("/ucitel/studio", "_blank", "noopener")}><ExternalLink className="mr-2 h-4 w-4" />Všechny typy ze Studia</Button>
                    {aiActivityButton}
                  </div>
                )}

                {sidebarSection === "lesson" && (
                  <div className="space-y-3">
                    <h2 className="font-deck-heading text-sm uppercase tracking-wide text-deck-violet-deep">Vložit z vlastního obsahu</h2>
                    <p className="text-xs text-deck-muted">Vyhledejte aktivitu ze svých lekcí nebo sad ze Studia a vložte ji do prezentace.</p>
                    <MyLessonActivitiesList onPick={(item) => insertActivitySlide(item.block, item.title)} onPickStudio={(item) => insertStudioSlide(item.slide, item.title)} />
                  </div>
                )}

                {sidebarSection === "templates" && (
                  <PresentationTemplatesPanel
                    userId={user?.id}
                    currentSlide={currentSlide}
                    allSlides={pendingSlides}
                    hasContent={!isEmptyNewPresentation}
                    themeId={themeId}
                    onThemeChange={setThemeId}
                    onInsertSlide={(slides) => {
                      insertSlidesAt(templateInsertAtIndex ?? editingSlideIndex + 1, cloneTemplateSlides(slides));
                      setTemplateInsertAtIndex(null);
                    }}
                    onApplyDeck={(slides) => {
                      setPendingSlides(slides);
                      setEditingSlideIndex(0);
                      setSelectedBlockId(null);
                    }}
                  />
                )}
              </PresentationLeftPanel>

              <main className="deck-center">
                <div className="deck-canvas-toolbar" data-slide-toolbar="true">
                  <div className="deck-global-tools">
                    <Button variant="ghost" size="icon" className="deck-tool-icon" onClick={() => history.undo()} disabled={!history.canUndo} aria-label="Zpět" title="Zpět (Ctrl/Cmd+Z)"><Undo2 /></Button>
                    <Button variant="ghost" size="icon" className="deck-tool-icon" onClick={() => history.redo()} disabled={!history.canRedo} aria-label="Znovu" title="Znovu (Ctrl/Cmd+Shift+Z)"><Redo2 /></Button>
                    <span className="deck-tool-separator" />
                    <Button variant="ghost" size="icon" className="deck-tool-icon" onClick={() => stepZoom(-25)} aria-label="Oddálit" title="Oddálit"><ZoomOut /></Button>
                    <Button variant="ghost" size="icon" className="deck-tool-icon" onClick={() => stepZoom(25)} aria-label="Přiblížit" title="Přiblížit"><ZoomIn /></Button>
                    <Button variant="ghost" size="icon" className="deck-tool-icon" onClick={() => { setZoom("fit"); setPan({ x: 0, y: 0 }); }} aria-label="Přizpůsobit velikost" title="Přizpůsobit velikost"><Maximize2 /></Button>
                    <span className="deck-tool-separator" />
                    <Button variant={drawMode ? "default" : "ghost"} size="icon" className="deck-tool-icon" onClick={() => { setDrawMode((v) => !v); setSelectedBlockId(null); }} aria-label="Tužka" title="Tužka" aria-pressed={drawMode}><Pencil /></Button>
                    {drawMode && <Popover><PopoverTrigger asChild><Button variant="outline" size="icon" className="deck-tool-icon" aria-label="Nastavení tužky" title="Nastavení tužky"><Settings2 /></Button></PopoverTrigger><PopoverContent className="w-64 space-y-3 p-3"><ColorPicker value={drawColor} onChange={(v) => setDrawColor(v || "#FDE047")} /><div><Label className="text-xs" htmlFor="draw-width">Tloušťka čáry</Label><Select value={String(drawWidth)} onValueChange={(v) => setDrawWidth(Number(v))}><SelectTrigger id="draw-width" className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{[1, 3, 5, 8].map((width) => <SelectItem key={width} value={String(width)}>{width} px</SelectItem>)}</SelectContent></Select></div><Button variant="outline" size="sm" className="w-full" disabled={!((currentSlide as any)?.drawingStrokes || []).length} onClick={() => updateSlide({ drawingStrokes: (((currentSlide as any).drawingStrokes || []) as DrawingStroke[]).slice(0, -1) })}><Eraser className="mr-2 h-4 w-4" />Guma – poslední tah</Button><Button variant="ghost" size="sm" className="w-full text-destructive" disabled={!((currentSlide as any)?.drawingStrokes || []).length} onClick={() => updateSlide({ drawingStrokes: [] })}>Vymazat vše</Button></PopoverContent></Popover>}
                    <Button variant="ghost" size="icon" className="deck-tool-icon" onClick={() => setDarkPreview((v) => !v)} aria-label={darkPreview ? "Světlý náhled" : "Tmavý náhled"} title={darkPreview ? "Světlý náhled" : "Tmavý náhled"}>{darkPreview ? <Sun /> : <Moon />}</Button>
                    <Popover open={animationPanelOpen} onOpenChange={setAnimationPanelOpen}><PopoverTrigger asChild><Button variant="ghost" size="icon" className="deck-tool-icon" aria-label="Animace stránky" title="Animace stránky"><Sparkles /></Button></PopoverTrigger><PopoverContent className="max-h-[min(76vh,680px)] w-[380px] overflow-y-auto p-4"><BlockAnimationPanel slide={currentSlide} block={null} onChange={() => undefined} onPreview={() => setAnimationPreviewKey((key) => key + 1)} onPlaySlide={() => setAnimationPreviewKey((key) => key + 1)} onReorder={(nextBlocks) => updateSlide({ blocks: nextBlocks })} onSelectBlock={(id) => { setSelectedBlockId(id); setAnimationPanelOpen(false); }} onClose={() => setAnimationPanelOpen(false)} /></PopoverContent></Popover>
                    {!thumbnailsOpen && <>
                      <SlideInsertMenu index={editingSlideIndex + 1} onPick={insertFromGap} trigger={<Button variant="ghost" size="icon" className="deck-tool-icon" aria-label="Vložit slide za aktuální" title="Vložit slide za aktuální"><Plus /></Button>} />
                      <SlideTransitionPopover slides={pendingSlides} index={Math.min(editingSlideIndex + 1, pendingSlides.length - 1)} onChange={changeSlideTransition} onApplyAll={applyTransitionEverywhere} compact trigger={<Button variant="ghost" size="icon" className="deck-tool-icon" disabled={editingSlideIndex >= pendingSlides.length - 1} aria-label="Přechod na další slide" title="Přechod na další slide"><ArrowLeftRight /></Button>} />
                      <Button variant="ghost" size="icon" className="deck-tool-icon text-destructive" onClick={deleteCurrentSlide} disabled={pendingSlides.length <= 1} aria-label="Smazat aktuální slide" title={pendingSlides.length <= 1 ? "Poslední slide nelze smazat" : "Smazat aktuální slide"}><Trash2 /></Button>
                    </>}
                  </div>
                  {selectedBlock && <div className="deck-floating-bar">
                    <PresentationCompactFormatToolbar
                      block={selectedBlock}
                      framed={!!getBlockFrame(selectedBlock)}
                      onChangeProps={(nextProps) => selectedBlockId && updateBlock(selectedBlockId, (b: Block) => ({ ...b, props: nextProps }))}
                      onChangeLayer={(action) => {
                        if (!selectedBlockId) return;
                        const framed = blocks.filter((b: Block) => !!getBlockFrame(b));
                        const idx = framed.findIndex((b: Block) => b.id === selectedBlockId);
                        const maxZ = framed.reduce((m: number, b: Block) => Math.max(m, typeof b.zIndex === "number" ? b.zIndex : 0), 0);
                        updateBlock(selectedBlockId, (b: Block) => {
                          const current = typeof b.zIndex === "number" ? b.zIndex : idx + 1;
                          const next = action === "front" ? maxZ + 1 : action === "forward" ? current + 1 : action === "backward" ? Math.max(1, current - 1) : 0;
                          return { ...b, zIndex: next };
                        });
                      }}
                      onMove={(dir) => selectedBlockId && moveBlock(selectedBlockId, dir)}
                      onCopyBlock={copyBlock}
                      onCopyStyle={copyStyle}
                      styleCopied={!!copiedStyle}
                      selectedCount={selectedBlockIds.length}
                      onAlign={alignSelectedToStage}
                      onFillStage={fillStageWithSelected}
                      onAlignGroup={alignSelectionTogether}
                      onDistribute={distributeSelection}
                      onGroup={groupSelection}
                      onUngroup={ungroupSelection}
                      slide={currentSlide}
                      onSlideBlocksChange={(nextBlocks) => updateSlide({ blocks: nextBlocks })}
                      onPreviewAnimation={() => setAnimationPreviewKey((key) => key + 1)}
                      onPlaySlide={() => setAnimationPreviewKey((key) => key + 1)}
                      onSelectBlock={setSelectedBlockId}
                      onDelete={() => { if (selectedBlockIds.length > 1) deleteSelection(); else if (selectedBlockId) { deleteBlock(selectedBlockId); setSelectedBlockId(null); } }}
                    />
                  </div>}
                </div>

                <div ref={canvasWrapRef} className={`relative flex min-h-0 flex-1 items-center justify-center p-3 ${zoom === "fit" ? "overflow-hidden" : "overflow-auto"}`}>
                  <SlideCanvas
                    slide={currentSlide}
                    themeId={themeId}
                    editable
                    showCorrectAnswers
                    darkMode={darkPreview}
                    animationPreviewKey={animationPreviewKey}
                    animationRevealCount={slideClickAnimations(blocks).length}
                    onChangeHeadline={(v) => updateProjector({ headline: v })}
                    onChangeBlock={updateBlock}
                    onMoveBlock={moveBlock}
                    onDeleteBlock={deleteBlock}
                    onChangeHeroImage={(url) => updateSlide({ heroImage: url })}
                    selectedBlockId={selectedBlockId}
                    selectedBlockIds={selectedBlockIds}
                    onSelectBlock={handleSelectBlock}
                    onSelectBlocks={setSelectedBlockIds}
                    drawMode={drawMode}
                    drawColor={drawColor}
                    drawWidth={drawWidth}
                    onAddStroke={(stroke: DrawingStroke) => updateSlide({ drawingStrokes: [...(((currentSlide as any).drawingStrokes || []) as DrawingStroke[]), stroke] })}
                    zoom={1}
                    absoluteScale={zoom === "fit" ? null : zoom / 100}
                    pan={pan}
                    onZoomChange={(z) => setZoom(Math.round(z * 100))}
                    onPanChange={setPan}
                  />
                </div>
              </main>

              {!propertiesOpen && <div className="deck-properties-reopen"><Button variant="outline" size="icon" onClick={() => setPropertiesOpen(true)} aria-label="Otevřít vlastnosti"><PropertiesIcon className="h-4 w-4" /></Button></div>}
              {propertiesOpen && isActivitySlide && activityPanelOpen && (!selectedBlock || selectedBlock.type === "activity") ? (
                <ActivitySettingsPanel
                  key={(currentSlide as any).slideId ?? editingSlideIndex}
                  slide={currentSlide}
                  onSlideChange={(next) => updateSlide(next)}
                  autoFocus={focusActivityFor === ((currentSlide as any).slideId ?? editingSlideIndex)}
                  printing={exportingPdf}
                  onPrint={handlePrintActivity}
                  onLaunch={launchWithCheck}
                  onClose={() => setPropertiesOpen(false)}
                  teacherNotes={(currentSlide as any).teacherNotes || ""}
                  onTeacherNotesChange={(teacherNotes) => updateSlide({ teacherNotes })}
                  settings={
                    <div className="space-y-3">
                      <div><Label className="text-xs">Typ aktivity</Label><Select value={(currentSlide as any).activitySpec?.activityType || "true_false"} onValueChange={(v) => { const prev = (currentSlide as any).activitySpec || {}; const becomesQuiz = (v === "quiz" || v === "mcq") && prev.timeLimitSec === undefined; const needsOptions = (v === "mcq" || v === "poll") && !(Array.isArray(prev.options) && prev.options.length); updateSlide({ activitySpec: { ...prev, activityType: v, ...(becomesQuiz ? { timeLimitSec: DEFAULT_NEW_QUIZ_TIME_SEC } : {}), ...(needsOptions ? { options: [{ text: "" }, { text: "" }, { text: "" }, { text: "" }], ...(v === "mcq" ? { correctIndex: 0 } : {}) } : {}) } }); }}><SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true_false">Pravda / Nepravda</SelectItem><SelectItem value="mcq">Kvíz – jedna otázka</SelectItem><SelectItem value="quiz">Kvíz – více otázek</SelectItem><SelectItem value="wordcloud">Slovní mrak</SelectItem><SelectItem value="poll">Anketa</SelectItem><SelectItem value="wall">Zeď odpovědí</SelectItem><SelectItem value="flashcards">Kartičky</SelectItem><SelectItem value="matching">Párování dvojic</SelectItem><SelectItem value="ordering">Seřazení kroků</SelectItem><SelectItem value="sorting">Třídění do skupin</SelectItem><SelectItem value="fill_blanks">Doplňovačka</SelectItem><SelectItem value="fill_choice">Doplňovačka s výběrem</SelectItem><SelectItem value="image_label">Obrázek s popisem</SelectItem><SelectItem value="image_hotspot">Obrázek – aktivní body</SelectItem><SelectItem value="reveal_cards">Odhalovací karty</SelectItem><SelectItem value="memory_game">Pexeso</SelectItem><SelectItem value="crossword">Křížovka</SelectItem><SelectItem value="open">Otevřená odpověď</SelectItem><SelectItem value="short_answer">Krátká odpověď</SelectItem><SelectItem value="word_search">Osmisměrka</SelectItem><SelectItem value="teams">Týmy</SelectItem><SelectItem value="differentiated">Diferencovaná aktivita</SelectItem><SelectItem value="escape">Úniková hra</SelectItem><SelectItem value="bezlistart">BezliStart</SelectItem><SelectItem value="summary">Shrnutí lekce</SelectItem></SelectContent></Select></div>
                      <div className="space-y-2"><Label className="text-xs">Herní režim tohoto slidu</Label><div className="grid grid-cols-2 gap-1.5"><button type="button" onClick={() => updateSlide({ gameSettings: undefined })} className={`rounded-lg border-2 px-2 py-1.5 text-[11px] ${!(currentSlide as any).gameSettings ? "border-deck-violet bg-deck-soft" : "border-deck-line"}`}>Jako celá prezentace</button>{SLIDE_GAME_MODES.map((mode) => { const active = (currentSlide as any).gameSettings?.mode === mode.id; return <button key={mode.id} type="button" onClick={() => updateSlide({ gameSettings: { ...(currentSlide as any).gameSettings, mode: mode.id } })} title={mode.hint} className={`rounded-lg border-2 px-2 py-1.5 text-[11px] ${active ? "border-deck-violet bg-deck-soft" : "border-deck-line"}`}>{mode.emoji} {mode.name}</button>; })}</div></div>
                    </div>
                  }
                />
              ) : propertiesOpen ? (
                <SelectionPropertiesPanel
                  slide={currentSlide}
                  block={selectedBlock}
                  themeId={themeId}
                  onThemeChange={setThemeId}
                  onSlideChange={updateSlide}
                  onBlockChange={updateBlock}
                  onClose={() => setPropertiesOpen(false)}
                >
                  {!selectedBlock && <>
                    <section className="space-y-2 border-t border-deck-line pt-4"><h3 className="font-deck-heading text-xs uppercase tracking-wide text-deck-violet-deep">Digi i offline</h3><Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={handlePrintActivity} disabled={exportingPdf}><FileDown className="h-3.5 w-3.5" />Vytisknout tento slide jako list</Button></section>
                    <section className="space-y-3 border-t border-deck-line pt-4"><h3 className="font-deck-heading text-xs uppercase tracking-wide text-deck-violet-deep">Výchozí přechod a písmo</h3><p className="text-[11px] text-deck-muted">Volba se použije na všechny slidy. Jednotlivé přechody nastavíte mezi miniaturami.</p><Select value={transition} onValueChange={(v) => setTransition(v as SlideTransition)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SLIDE_TRANSITIONS.map((item) => <SelectItem key={item.value} value={item.value} title={item.hint}>{item.label}</SelectItem>)}</SelectContent></Select><Label className="text-xs" htmlFor="slide-font-scale">Velikost písma slidu</Label><input id="slide-font-scale" type="range" min={0.7} max={1.6} step={0.05} value={(currentSlide?.projector?.fontScale as number) || 1} onChange={(e) => updateProjector({ fontScale: parseFloat(e.target.value) })} className="w-full accent-deck-violet" /></section>
                    <section className="space-y-2 border-t border-deck-line pt-4"><h3 className="font-deck-heading text-xs uppercase tracking-wide text-deck-violet-deep">Obrázek pozadí</h3><MediaPickerDialog imageOnly onPick={(url, item) => { void insertPersistentImage(url, item, (finalUrl) => updateSlide({ backgroundOverride: { image: finalUrl } })); }} trigger={<Button variant="outline" size="sm" className="w-full"><ImageIcon className="mr-1 h-3.5 w-3.5" />Vybrat obrázek</Button>} /><GameBackgroundPickerDialog onPick={(url) => updateSlide({ backgroundOverride: { image: url } })} trigger={<Button variant="outline" size="sm" className="w-full"><Gamepad2 className="mr-1 h-3.5 w-3.5" />Herní pozadí</Button>} />{(currentSlide as any).backgroundOverride?.image && <Button variant="ghost" size="sm" onClick={() => updateSlide({ backgroundOverride: null })}>Odebrat obrázek pozadí</Button>}</section>
                    {isZoomableSlide(currentSlide) && <Collapsible className="rounded-lg border border-deck-line"><CollapsibleTrigger className="flex w-full items-center justify-between p-2 text-xs"><span>Zóny přiblížení ({(currentSlide.zoomZones || []).length})</span><ChevronDown className="h-4 w-4" /></CollapsibleTrigger><CollapsibleContent className="p-2"><ZoomZonesEditor slide={currentSlide} darkMode={darkPreview} onChange={(zoomZones: ZoomZone[]) => updateSlide({ zoomZones })} /></CollapsibleContent></Collapsible>}
                    {blocks.length > 0 && <Collapsible className="rounded-lg border border-deck-line"><CollapsibleTrigger className="flex w-full items-center justify-between p-2 text-xs"><span>Volné umístění prvků</span><ChevronDown className="h-4 w-4" /></CollapsibleTrigger><CollapsibleContent className="space-y-1 p-2">{blocks.map((block, index) => { const free = !!getBlockFrame(block); return <div key={block.id} className="flex items-center gap-2"><button type="button" className="min-w-0 flex-1 truncate text-left text-[11px]" onClick={() => setSelectedBlockId(block.id)}>{blockLabel(block, index)}</button><Switch checked={free} aria-label={`Volné umístění bloku ${index + 1}`} onCheckedChange={(value) => updateBlock(block.id, (previous: Block) => { if (value) return { ...previous, frame: { ...DEFAULT_BLOCK_FRAME } }; const { frame, ...rest } = previous as any; return rest as Block; })} /></div>; })}</CollapsibleContent></Collapsible>}
                    {linkedToLesson && <section className="space-y-2 border-t border-deck-line pt-4"><h3 className="font-deck-heading text-xs uppercase tracking-wide text-deck-violet-deep">Propojení s lekcí</h3>{currentSlide?.lockedFromLesson ? <Button variant="outline" size="sm" disabled={!generatedSlides.length} onClick={() => { const restored = restoreSlideFromLesson(generatedSlides, pendingSlides, editingSlideIndex); if (!restored) { toast({ title: "Snímek v lekci neexistuje", variant: "destructive" }); return; } const updated = [...pendingSlides]; updated[editingSlideIndex] = restored; setPendingSlides(updated); }}><RotateCcw className="mr-1 h-3.5 w-3.5" />Obnovit z učebnice</Button> : <Button variant="outline" size="sm" onClick={() => updateSlide({ lockedFromLesson: true }, { markEdited: false })}><LockOpen className="mr-1 h-3.5 w-3.5" />Neaktualizovat z lekce</Button>}</section>}
                  </>}
                  {selectedBlock?.type === "activity" && <ActivityAppearanceControls value={(selectedBlock.props as any)?.slideAppearance} onChange={(slideAppearance) => updateBlock(selectedBlock.id, (b: Block) => ({ ...b, props: { ...b.props, slideAppearance } }))} />}
                </SelectionPropertiesPanel>
              ) : null}
            </div>
          )}

          <PresentationThumbnails
            slides={pendingSlides}
            activeIndex={editingSlideIndex}
            selectedIndices={selectedSlideIndices}
            themeId={themeId}
            onSelect={selectSlide}
            onMove={moveSlide}
            onAdd={() => openAddSlideAt(editingSlideIndex + 1)}
            onDelete={deleteSlides}
            onDuplicate={duplicateSlides}
            onMoveEdge={moveSlidesToEdge}
            onToggleHidden={toggleSlidesHidden}
            onInsert={insertFromGap}
            onTransitionChange={changeSlideTransition}
            onApplyTransitionAll={applyTransitionEverywhere}
            open={thumbnailsOpen}
            onToggle={() => setThumbnailsOpen((value) => !value)}
            onPrevious={() => selectSlide(Math.max(0, editingSlideIndex - 1))}
            onNext={() => selectSlide(Math.min(pendingSlides.length - 1, editingSlideIndex + 1))}
          />

          <ImportPptxToPresentationDialog open={importPptxOpen} onOpenChange={setImportPptxOpen} themeId={themeId} userId={user?.id} onImported={(slides) => { const updated = [...pendingSlides, ...slides]; setPendingSlides(updated); setEditingSlideIndex(pendingSlides.length); setSelectedBlockId(null); }} />
          <PresentationExportDialog open={exportOpen} onOpenChange={setExportOpen} slides={pendingSlides} title={presentationLesson?.title || "prezentace"} onExportPdf={handleExportPdf} />
          <AddSlideSheet open={addSlideOpen} onOpenChange={setAddSlideOpen} slides={pendingSlides} layoutsOnly showLibrary onAddSlides={(newSlides) => { insertSlidesAt(insertAtIndex ?? pendingSlides.length, newSlides); setInsertAtIndex(null); }} />
          <InsertActivityDialog open={insertActivityOpen} onOpenChange={(open) => { setInsertActivityOpen(open); if (!open) setActivityInsertAtIndex(null); }} themeId={themeId} onInsert={(slide, target) => insertBuiltActivity(slide, activityTypeLabel(slide.activitySpec?.activityType), target)} />
          <InsertSlidesDialog open={insertSlidesOpen} onOpenChange={(open) => { setInsertSlidesOpen(open); if (!open) setSlidesInsertAtIndex(null); }} themeId={themeId} currentPresentationId={source?.type === "standalone" ? source.presentationId : undefined} fixedPlacement={slidesInsertAtIndex !== null} onInsert={(slides, position) => { const at = slidesInsertAtIndex ?? (position === "end" ? pendingSlides.length : editingSlideIndex + (position === "after" ? 1 : 0)); insertSlidesAt(at, slides.map((slide) => markSlideEditedByTeacher(slide, linkedToLesson))); setSlidesInsertAtIndex(null); }} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmClose} onOpenChange={(open) => { if (!open) setConfirmClose(null); }}>
        <AlertDialogContent className="font-deck-body">
          <AlertDialogHeader><AlertDialogTitle className="font-deck-heading uppercase tracking-wide text-deck-violet-deep">Neuložené změny</AlertDialogTitle><AlertDialogDescription>V prezentaci máte změny, které ještě nejsou uložené. Když editor zavřete, ztratí se.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Pokračovat v úpravách</AlertDialogCancel>
            {onSave && <AlertDialogAction className="bg-deck-violet text-deck-on-violet hover:bg-deck-violet-deep" onClick={async () => { const after = confirmClose?.after; try { await onSave(pendingSlides); baselineRef.current = JSON.stringify(pendingSlides); setConfirmClose(null); onClose(); after?.(); } catch (e: any) { toast({ title: "Uložení se nepodařilo", description: e?.message ?? String(e), variant: "destructive" }); } }}>Uložit a zavřít</AlertDialogAction>}
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { const after = confirmClose?.after; setConfirmClose(null); baselineRef.current = null; onClose(); after?.(); }}>Zavřít bez uložení</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingSlideDelete} onOpenChange={(open) => { if (!open) setPendingSlideDelete(null); }}>
        <AlertDialogContent className="font-deck-body">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-deck-heading text-deck-violet-deep">
              {pendingSlideDelete?.length === 1
                ? `Opravdu smazat slide ${pendingSlideDelete[0] + 1}?`
                : `Opravdu smazat vybrané slidy (${(pendingSlideDelete ?? []).map((index) => index + 1).join(", ")})?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tuto akci lze vrátit tlačítkem Zpět.
              {(pendingSlideDelete ?? []).some((index) => slideContainsActivity(pendingSlides[index])) && " Smazáním zmizí i aktivity na vybraných slidech."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { const selected = pendingSlideDelete ?? []; setPendingSlideDelete(null); performDeleteSlides(selected); }}>Smazat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!existingSession} onOpenChange={(open) => { if (!open) onCloseExisting(); }}>
        <DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Existující prezentace</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Máte rozdělanou prezentaci pro tuto lekci. Chcete pokračovat nebo začít novou?</p><DialogFooter className="mt-4 flex-col gap-2 sm:flex-row"><Button variant="outline" className="w-full" onClick={onContinueExisting}>Pokračovat v rozběhlé</Button><Button className="w-full" onClick={onLaunchNew}>Spustit novou</Button></DialogFooter></DialogContent>
      </Dialog>
    </>
  );
};

export default PresentationEditorDialog;
