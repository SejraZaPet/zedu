import { BetaBadge } from "@/components/common/BetaBadge";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Monitor, Plus, Trash2, ChevronDown, Save, Sun, Moon, Type, List, Image as ImageIcon,
  Table as TableIcon, Settings2, Undo2, Redo2, ZoomIn, ZoomOut, Copy, FileDown, Heading as HeadingIcon,
  Quote as QuoteIcon, StickyNote, BarChart3, Sigma, Video as VideoIcon, Music, Loader2, Bookmark,
  Wand2, Settings, Puzzle, ArrowLeft, ExternalLink, Gamepad2, Move, FileUp,
} from "lucide-react";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { SLIDE_GAME_MODES } from "@/lib/game-slide-settings";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import BlockEditor, { SingleBlockEditor, type BlockEditorHistory } from "@/components/admin/BlockEditor";
import SlideCanvas, { SLIDE_LAYOUTS, type SlideLayout } from "@/components/admin/SlideCanvas";
import { MediaPickerDialog } from "@/components/media/MediaPickerDialog";
import { AddSlideSheet } from "@/components/game/AddSlideSheet";
import { createDefaultBlock, type Block } from "@/lib/textbook-config";
import { SLIDE_BACKGROUND_COLORS } from "@/lib/slide-typography";
import ZoomZonesEditor from "@/components/admin/ZoomZonesEditor";
import { isZoomableSlide, type ZoomZone } from "@/lib/zoom-zones";
import { DEFAULT_BLOCK_FRAME, getBlockFrame } from "@/lib/block-frame";
import { Switch } from "@/components/ui/switch";
import ImportPptxToPresentationDialog from "@/components/admin/ImportPptxToPresentationDialog";
import ThemeGalleryPopover from "@/components/admin/ThemeGalleryPopover";
import StartFromTemplateDialog from "@/components/admin/StartFromTemplateDialog";
import IconPickerDialog from "@/components/admin/IconPickerDialog";
import { SlideBody } from "@/components/admin/SlideCanvas";
import { STAGE_W, STAGE_H } from "@/components/admin/SlideCanvas";
import { applyThemeToSlides, getPresentationTheme, themeIdFromSlides, themeStageStyle } from "@/lib/presentation-themes";
import { LayoutTemplate, Shapes, Pencil, Eraser } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SLIDE_TRANSITIONS, transitionFromSlides, applyTransitionToSlides, type SlideTransition } from "@/lib/slide-transitions";
import { exportSlidesToPdf } from "@/lib/presentation-pdf-export";
import ShapePickerPopover from "@/components/admin/ShapePickerPopover";
import ColorPicker from "@/components/admin/ColorPicker";
import type { DrawingStroke } from "@/components/admin/SlideDrawingLayer";
import AiBlockTextButton from "@/components/admin/AiBlockTextButton";
import SlideFloatingFormatToolbar from "@/components/admin/SlideFloatingFormatToolbar";
import { activityBlockToSlide, mapPlanKindToActivityType } from "@/lib/plan-to-slides";
import MyLessonActivitiesList from "@/components/presentation/MyLessonActivitiesList";
import GameBackgroundPickerDialog from "@/components/game/GameBackgroundPickerDialog";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
    className="flex flex-col items-center gap-1 rounded-lg border border-border bg-background px-1.5 py-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:bg-muted/60 hover:text-foreground"
  >
    <Icon className="h-4 w-4" />
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
  presentationLesson, source, pendingSlides, setPendingSlides,
  editingSlideIndex, setEditingSlideIndex,
  onClose, onLaunch, onSave, hasSavedPresentation,
  existingSession, onContinueExisting, onLaunchNew, onCloseExisting,
}: Props) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [darkPreview, setDarkPreview] = useState(true);
  const [addSlideOpen, setAddSlideOpen] = useState(false);
  const [history, setHistory] = useState<BlockEditorHistory | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [importPptxOpen, setImportPptxOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [generatingActivity, setGeneratingActivity] = useState(false);
  const [sidebarSection, setSidebarSection] = useState<"insert" | "slide" | "activities">("insert");
  const [teacherNotesOpen, setTeacherNotesOpen] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState("#FDE047");
  const [drawWidth, setDrawWidth] = useState(3);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const currentSlide = pendingSlides[editingSlideIndex];
  const themeId = themeIdFromSlides(pendingSlides);
  const theme = getPresentationTheme(themeId);

  const setThemeId = (next: string) => setPendingSlides(applyThemeToSlides(pendingSlides, next));
  const transition = transitionFromSlides(pendingSlides);
  const setTransition = (next: SlideTransition) =>
    setPendingSlides(applyTransitionToSlides(pendingSlides, next));

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

  useEffect(() => {
    if (presentationLesson && isEmptyNewPresentation) setTemplateOpen(true);
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
      const updated = [...pendingSlides];
      updated[editingSlideIndex] = {
        ...currentSlide,
        blocks: [seeded],
        projector: { ...currentSlide.projector, body: "" },
      };
      setPendingSlides(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSlideIndex, currentSlide?.slideId]);

  // Při přepnutí snímku sbal prázdné pole poznámek a schovej plovoucí lištu
  useEffect(() => {
    setTeacherNotesOpen(false);
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
        target.closest("[data-radix-popper-content-wrapper]")
      ) {
        return;
      }
      setSelectedBlockId(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);


  const updateSlide = (patch: any) => {
    const updated = [...pendingSlides];
    updated[editingSlideIndex] = { ...updated[editingSlideIndex], ...patch };
    setPendingSlides(updated);
  };
  const updateProjector = (patch: any) => {
    updateSlide({ projector: { ...currentSlide?.projector, ...patch } });
  };
  const blocks: Block[] = ((currentSlide?.blocks || []) as Block[]);
  const setBlocks = (next: Block[]) => updateSlide({ blocks: next });
  const addBlock = (type: Block["type"]) => setBlocks([...blocks, createDefaultBlock(type)]);
  const moveBlock = (id: string, dir: "up" | "down") => {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };
  const deleteBlock = (id: string) => setBlocks(blocks.filter((b) => b.id !== id));
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
        return typeof patch === "function" ? patch(b) : { ...b, ...patch };
      });
      const updated = [...prev];
      updated[editingSlideIndex] = { ...slide, blocks: nextBlocks };
      return updated;
    });
  };
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

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

      updateSlide({
        type: "activity",
        projector: { ...currentSlide.projector, headline: question },
        device: { ...currentSlide.device, instructions: "Vyberte správnou odpověď." },
        activitySpec: {
          activityType: mapPlanKindToActivityType((currentSlide as any).planActivityKind) === "quiz"
            ? "quiz"
            : mapPlanKindToActivityType((currentSlide as any).planActivityKind),
          question,
          options: options.map((text, i) => ({
            text,
            correct: i === correctIndex,
            isCorrect: i === correctIndex,
          })),
          correctIndex,
        },
        ai_generated: true,
      });
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

  const isStandalone = source?.type === "standalone";

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
    const slide = activityBlockToSlide(block);
    const updated = [...pendingSlides];
    updated.splice(editingSlideIndex + 1, 0, slide);
    setPendingSlides(updated);
    setEditingSlideIndex(editingSlideIndex + 1);
    setSelectedBlockId(null);
    toast({ title: "Aktivita vložena", description: `„${label}" byla přidána jako nový slide.` });
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

  const RAIL_ITEMS = [
    { id: "insert" as const, icon: Plus, label: "Vložit" },
    { id: "slide" as const, icon: Settings, label: "Slide" },
    { id: "activities" as const, icon: Puzzle, label: "Aktivity" },
  ];



  return (
    <>
      <Dialog open={!!presentationLesson && pendingSlides.length > 0} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="flex h-[93vh] max-w-[1500px] flex-col gap-0 overflow-hidden p-0">
          {/* 1. HORNÍ PANEL – jeden řádek: vlevo vzhled slidu, vpravo akce s dokumentem */}
          <DialogHeader className="shrink-0 space-y-0 border-b border-border bg-muted/60 px-4 py-2 backdrop-blur-sm">
            <DialogTitle className="sr-only">
              Editor prezentace – {presentationLesson?.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Úprava slidů prezentace: vzhled, obsah a spuštění živé prezentace.
            </DialogDescription>

            <div className="flex flex-wrap items-center gap-2">
              {/* ČÁST 2 – zpět na lekci / na seznam samostatných prezentací */}
              {lessonBackUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 max-w-[220px] gap-1.5 text-xs"
                  onClick={() => { onClose(); navigate(lessonBackUrl); }}
                  title={isStandalone ? "Zpět na prezentace" : `Zpět na lekci ${presentationLesson?.title ?? ""}`}
                >
                  <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {isStandalone
                      ? "Zpět na prezentace"
                      : `Zpět na lekci${presentationLesson?.title ? `: ${presentationLesson.title}` : ""}`}
                  </span>
                </Button>
              )}


              {/* Skupina „vzhled slidu“ */}

              <div className="flex items-center gap-2 rounded-lg border border-border bg-background/70 px-2 py-1">
                <Select value={transition} onValueChange={(v) => setTransition(v as SlideTransition)}>
                  <SelectTrigger className="h-8 w-[124px] text-xs" title="Přechod mezi slidy">
                    <SelectValue placeholder="Přechod" />
                  </SelectTrigger>
                  <SelectContent>
                    {SLIDE_TRANSITIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value} title={t.hint}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1.5">
                  <Label className="whitespace-nowrap text-xs text-muted-foreground">Písmo</Label>
                  <input
                    type="range"
                    min={0.7}
                    max={1.6}
                    step={0.05}
                    value={(currentSlide?.projector?.fontScale as number) || 1}
                    onChange={(e) => updateProjector({ fontScale: parseFloat(e.target.value) })}
                    className="w-20 accent-primary"
                    aria-label="Velikost písma slidu"
                  />
                  <span className="w-9 tabular-nums text-xs text-muted-foreground">
                    {Math.round(((currentSlide?.projector?.fontScale as number) || 1) * 100)}%
                  </span>
                </div>

                <ThemeGalleryPopover themeId={themeId} onChange={setThemeId} />

                <button
                  type="button"
                  onClick={() => setDarkPreview((v) => !v)}
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {darkPreview ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                  {darkPreview ? "Světlý" : "Tmavý"}
                </button>
              </div>

              <Badge variant={hasSavedPresentation ? "default" : "secondary"} className="hidden text-xs lg:inline-flex">
                {hasSavedPresentation ? "Uložená prezentace" : "Nová prezentace"}
              </Badge>

              {/* Skupina „akce s dokumentem“ */}
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={handleExportPdf} disabled={exportingPdf}>
                  {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  PDF
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={onClose}>Zrušit</Button>
                {onSave && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={async () => {
                      await onSave(pendingSlides);
                      toast({ title: "Prezentace uložena", description: "Změny byly uloženy k lekci." });
                    }}
                  >
                    <Save className="h-4 w-4" /> Uložit
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => onLaunch(pendingSlides)}
                  className="h-8 gap-1.5 border-0 bg-gradient-brand text-white hover:opacity-90"
                >
                  <Monitor className="h-4 w-4" /> Spustit prezentaci
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* 2. NÁHLEDY SLIDŮ – kompaktní vodorovný pruh */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background/60 px-4 py-2">
            <div className="flex flex-1 items-stretch gap-2 overflow-x-auto pb-1">
              {pendingSlides.map((slide, i) => (
                <div key={slide?.slideId || i} className="flex flex-shrink-0 items-stretch gap-2">
                  {slide?.sectionTitle ? (
                    <div className="flex flex-col items-center justify-center border-l-2 border-primary pl-1.5">
                      <span className="max-w-[70px] text-[9px] font-semibold uppercase leading-tight tracking-wide text-primary">
                        {slide.sectionTitle}
                      </span>
                    </div>
                  ) : null}
                  <button
                    onClick={() => { setEditingSlideIndex(i); setSelectedBlockId(null); }}
                    title={slide.projector?.headline || `Slide ${i + 1}`}
                    className={`relative aspect-video w-20 flex-shrink-0 xl:w-28 overflow-hidden rounded-md border-2 transition-colors ${
                      i === editingSlideIndex ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-muted-foreground/50"
                    }`}
                    style={themeStageStyle(theme)}
                  >
                    <div className="pointer-events-none absolute left-0 top-0 origin-top-left scale-[0.714] xl:scale-100">
                    <div
                      className="absolute left-0 top-0 origin-top-left"
                      style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${112 / STAGE_W})` }}
                    >
                      <SlideBody slide={slide} themeId={themeId} />
                    </div>
                    </div>
                    <span className="absolute bottom-0.5 left-0.5 rounded bg-background/85 px-1 text-[9px] font-semibold text-foreground">
                      {i + 1}
                    </span>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-1 border-l border-border pl-2">
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setAddSlideOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Slide
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                title="Duplikovat slide"
                onClick={() => {
                  const src = pendingSlides[editingSlideIndex];
                  if (!src) return;
                  const copy = JSON.parse(JSON.stringify(src));
                  copy.slideId = crypto.randomUUID();
                  if (Array.isArray(copy.blocks)) {
                    copy.blocks = copy.blocks.map((b: any) => ({ ...b, id: crypto.randomUUID() }));
                  }
                  const updated = [...pendingSlides];
                  updated.splice(editingSlideIndex + 1, 0, copy);
                  setPendingSlides(updated);
                  setEditingSlideIndex(editingSlideIndex + 1);
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              {pendingSlides.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-destructive"
                  title="Smazat slide"
                  onClick={() => {
                    const updated = pendingSlides.filter((_, i) => i !== editingSlideIndex);
                    setPendingSlides(updated);
                    setEditingSlideIndex(Math.min(editingSlideIndex, updated.length - 1));
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {currentSlide && (
            <div className="flex min-h-0 flex-1">
              {/* 3. LEVÝ POSTRANNÍ PANEL */}
              <aside data-slide-sidebar="true" className="flex shrink-0 border-r border-border bg-muted/20">
                {/* Úzký sloupec ikon (Canva style) */}
                <div className="flex w-16 shrink-0 flex-col gap-1 border-r border-border py-2">
                  {RAIL_ITEMS.map((item) => {
                    const active = sidebarSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSidebarSection(item.id)}
                        aria-pressed={active}
                        className={`mx-1 flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors ${
                          active ? "bg-accent/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                      >
                        <item.icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {/* Rozbalovací panel vybrané sekce */}
                <div className="flex min-h-0 w-[200px] flex-col overflow-y-auto xl:w-[240px]">
                  {sidebarSection === "insert" && (
                  <div className="p-2">

                    <div className="grid grid-cols-3 gap-1.5">
                      <InsertTile icon={HeadingIcon} label="Nadpis" onClick={() => addBlock("heading")} />
                      <InsertTile icon={Type} label="Text" onClick={() => addBlock("paragraph")} />
                      <InsertTile icon={List} label="Odrážky" onClick={() => addBlock("bullet_list")} />
                      <InsertTile icon={StickyNote} label="Box" onClick={() => addBlock("callout")} />
                      <InsertTile icon={QuoteIcon} label="Citace" onClick={() => addBlock("quote")} />
                      <InsertTile icon={TableIcon} label="Tabulka" onClick={() => addBlock("table")} />
                      <InsertTile icon={BarChart3} label="Graf" onClick={() => addBlock("chart")} />
                      <InsertTile icon={Sigma} label="Rovnice" onClick={() => addBlock("formula")} />
                      <InsertTile icon={VideoIcon} label="Video" onClick={() => addBlock("video")} />
                      <InsertTile icon={Music} label="Zvuk" onClick={() => addBlock("audio")} />

                      <MediaPickerDialog
                        imageOnly
                        onPick={(url) => {
                          const newBlock = createDefaultBlock("image");
                          newBlock.props = { ...newBlock.props, url };
                          setBlocks([...blocks, newBlock]);
                        }}
                        trigger={
                          <button
                            type="button"
                            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-background px-1.5 py-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:bg-muted/60 hover:text-foreground"
                          >
                            <ImageIcon className="h-4 w-4" />
                            <span className="leading-tight">Obrázek</span>
                          </button>
                        }
                      />

                      <IconPickerDialog
                        themeId={themeId}
                        onPick={({ name, color }) => {
                          const newBlock = createDefaultBlock("image");
                          newBlock.props = { ...newBlock.props, url: "", icon: name, iconColor: color, width: "medium" };
                          setBlocks([...blocks, newBlock]);
                        }}
                        trigger={
                          <button
                            type="button"
                            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-background px-1.5 py-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:bg-muted/60 hover:text-foreground"
                          >
                            <Shapes className="h-4 w-4" />
                            <span className="leading-tight">Ikona</span>
                          </button>
                        }
                      />
                    </div>

                    <div className="mt-3 space-y-2 border-t border-border pt-3">
                      <ShapePickerPopover
                        onPick={(props) => {
                          const newBlock = createDefaultBlock("shape");
                          newBlock.props = { ...newBlock.props, ...props };
                          // Tvary vkládáme přímo do volné vrstvy, ať jdou hned posouvat a resizovat.
                          (newBlock as any).frame = { x: 20, y: 20, w: 60, h: 40 };
                          setBlocks([...blocks, newBlock]);
                        }}
                      />
                      <AiBlockTextButton
                        block={selectedBlock}
                        headline={currentSlide.projector?.headline || ""}
                        lessonTitle={presentationLesson?.title || ""}
                        onAccept={(text) => {
                          if (!selectedBlockId) return;
                          updateBlock(selectedBlockId, (b: Block) => ({
                            ...b,
                            props: { ...b.props, text: b.type === "heading" ? text : `<p>${text}</p>` },
                          }));
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-start gap-1.5 text-xs"
                        onClick={() => setTemplateOpen(true)}
                      >
                        <LayoutTemplate className="h-3.5 w-3.5" /> Začít od šablony
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-start gap-1.5 text-xs"
                        onClick={() => setImportPptxOpen(true)}
                      >
                        <FileUp className="h-3.5 w-3.5" /> Importovat prezentaci (.pptx)
                      </Button>
                    </div>
                  </div>
                  )}

                  {/* ---- Sekce Slide ---- */}
                  {sidebarSection === "slide" && (
                  <div className="space-y-4 p-3">

                    <div>
                      <Label className="text-xs">Rozvržení</Label>
                      <Select
                        value={(currentSlide.layout as SlideLayout) || "full"}
                        onValueChange={(v) => updateSlide({ layout: v as SlideLayout })}
                      >
                        <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SLIDE_LAYOUTS.map((l) => (
                            <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Volné umístění bloků (opt-in) */}
                    {blocks.length > 0 && (
                      <div className="space-y-2 rounded-lg border border-border p-2">
                        <Label className="flex items-center gap-1.5 text-xs">
                          <Move className="h-3.5 w-3.5" /> Volné umístění bloků
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Blok můžete přetáhnout myší přímo na slidu — tím se automaticky vyjme
                          z lineárního rozvržení. Vypnutím přepínače ho vrátíte zpět do flow.
                        </p>
                        <div className="space-y-1.5">
                          {blocks.map((b, i) => {
                            const free = !!getBlockFrame(b);
                            return (
                              <div
                                key={b.id}
                                className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 ${
                                  selectedBlockId === b.id ? "border-primary bg-primary/5" : "border-border"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedBlockId(b.id)}
                                  className="min-w-0 flex-1 truncate text-left text-[11px] text-muted-foreground hover:text-foreground"
                                  title={blockLabel(b, i)}
                                >
                                  {blockLabel(b, i)}
                                </button>
                                <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                                  {free ? "Vrátit do flow" : "Volné umístění"}
                                </span>
                                <Switch
                                  checked={free}
                                  aria-label={
                                    free
                                      ? `Vrátit blok ${i + 1} do flow`
                                      : `Volné umístění bloku ${i + 1}`
                                  }
                                  onCheckedChange={(v) => {
                                    setSelectedBlockId(b.id);
                                    updateBlock(b.id, (prev: Block) => {
                                      if (v) return { ...prev, frame: { ...DEFAULT_BLOCK_FRAME } };
                                      const { frame, ...rest } = prev as any;
                                      return rest as Block;
                                    });
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    )}



                    {/* Zóny přiblížení */}
                    {isZoomableSlide(currentSlide) && (
                      <Collapsible className="rounded-lg border border-border">
                        <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40">
                          <span className="flex items-center gap-1.5">
                            <ZoomIn className="h-3.5 w-3.5" />
                            Zóny přiblížení ({(currentSlide.zoomZones || []).length})
                          </span>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-2 pb-2">
                          <ZoomZonesEditor
                            slide={currentSlide}
                            darkMode={darkPreview}
                            onChange={(zones: ZoomZone[]) => updateSlide({ zoomZones: zones })}
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Pozadí slidu */}
                    <div className="space-y-2">
                      <Label className="text-xs">Pozadí tohoto slidu</Label>
                      <button
                        type="button"
                        onClick={() => updateSlide({ backgroundOverride: null })}
                        className={`w-full rounded-lg border-2 px-2 py-1 text-xs font-medium transition-colors ${
                          !(currentSlide as any).backgroundOverride
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        Podle tématu prezentace
                      </button>
                      <ColorPicker
                        value={(currentSlide as any).backgroundOverride?.color || null}
                        onChange={(v) =>
                          updateSlide({ backgroundOverride: v ? { color: v } : null })
                        }
                        swatches={SLIDE_BACKGROUND_COLORS}
                      />

                      <div className="grid grid-cols-1 gap-1.5">
                        <MediaPickerDialog
                          imageOnly
                          onPick={(url) => updateSlide({ backgroundOverride: { image: url } })}
                          trigger={
                            <Button size="sm" variant="outline" className="h-7 w-full gap-1 text-xs">
                              <ImageIcon className="h-3.5 w-3.5" /> Obrázek pozadí
                            </Button>
                          }
                        />
                        <GameBackgroundPickerDialog
                          onPick={(url) => updateSlide({ backgroundOverride: { image: url } })}
                          trigger={
                            <Button size="sm" variant="outline" className="h-7 w-full gap-1 text-xs">
                              <Gamepad2 className="h-3.5 w-3.5" /> Vybrat z herních pozadí
                            </Button>
                          }
                        />
                        <div className="flex justify-end">
                          <BetaBadge context="Editor prezentace – herní pozadí" />
                        </div>
                      </div>

                      {(currentSlide as any).backgroundOverride?.image && (
                        <div className="flex items-center gap-2">
                          <img
                            src={(currentSlide as any).backgroundOverride.image}
                            alt="Náhled pozadí slidu"
                            className="h-7 w-12 rounded border border-border object-cover"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => updateSlide({ backgroundOverride: null })}
                          >
                            Odebrat
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Název sekce */}
                    <div>
                      <Label className="flex items-center gap-1.5 text-xs">
                        <Bookmark className="h-3.5 w-3.5" /> Název sekce (nepovinné)
                      </Label>
                      <Input
                        className="mt-1 h-8 text-xs"
                        value={(currentSlide as any).sectionTitle || ""}
                        onChange={(e) => updateSlide({ sectionTitle: e.target.value || undefined })}
                        placeholder="Např. Opakování"
                      />
                    </div>

                    {/* Instrukce pro žáka */}
                    <div>
                      <Label className="text-xs">Instrukce pro žáka</Label>
                      <Input
                        className="mt-1 h-8 text-xs"
                        value={currentSlide.device?.instructions || ""}
                        onChange={(e) => updateSlide({ device: { ...currentSlide.device, instructions: e.target.value } })}
                      />
                    </div>

                    {/* B3 – dogenerovat aktivitu z textového slidu (též v sekci Aktivity) */}
                    {currentSlide?.type !== "activity" && aiActivityButton}


                    {/* Nastavení aktivity */}
                    {currentSlide?.type === "activity" && (
                      <div className="space-y-3 border-t border-border pt-3">
                        <div>
                          <Label className="text-xs">Typ aktivity</Label>
                          <Select
                            value={(currentSlide as any).activitySpec?.activityType || "true_false"}
                            onValueChange={(v) => updateSlide({ activitySpec: { ...(currentSlide as any).activitySpec, activityType: v } })}
                          >
                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true_false">Pravda / Nepravda</SelectItem>
                              <SelectItem value="quiz">Kvíz (výběr odpovědi)</SelectItem>
                              <SelectItem value="poll">Hlasování / Mentimetr</SelectItem>
                              <SelectItem value="wall">Zeď odpovědí</SelectItem>
                              <SelectItem value="flashcards">Kartičky (Flashcards)</SelectItem>
                              <SelectItem value="matching">Párování / Spojování dvojic</SelectItem>
                              <SelectItem value="ordering">Seřazení kroků</SelectItem>
                              <SelectItem value="sorting">Třídění do skupin</SelectItem>
                              <SelectItem value="fill_blanks">Doplňovačka</SelectItem>
                              <SelectItem value="fill_choice">Doplňovačka s výběrem</SelectItem>
                              <SelectItem value="image_label">Obrázek s popisem</SelectItem>
                              <SelectItem value="image_hotspot">Obrázek – aktivní body</SelectItem>
                              <SelectItem value="reveal_cards">Odhalovací karty</SelectItem>
                              <SelectItem value="memory_game">Pexeso</SelectItem>
                              <SelectItem value="crossword">Křížovka</SelectItem>
                              <SelectItem value="open">Otevřená odpověď</SelectItem>
                              <SelectItem value="summary">Shrnutí lekce</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Herní režim tohoto slidu</Label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateSlide({ gameSettings: undefined })}
                              className={`rounded-lg border-2 px-2 py-1.5 text-[11px] font-medium transition-colors ${
                                !(currentSlide as any).gameSettings
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border text-muted-foreground hover:bg-muted/50"
                              }`}
                            >
                              Jako celá prezentace
                            </button>
                            {SLIDE_GAME_MODES.map((m) => {
                              const active = (currentSlide as any).gameSettings?.mode === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => updateSlide({
                                    gameSettings: {
                                      mode: m.id,
                                      teamMode: (currentSlide as any).gameSettings?.teamMode ?? "none",
                                    },
                                  })}
                                  title={m.hint}
                                  className={`rounded-lg border-2 px-2 py-1.5 text-[11px] font-medium transition-colors ${
                                    active
                                      ? "border-primary bg-primary/10 text-foreground"
                                      : "border-border text-muted-foreground hover:bg-muted/50"
                                  }`}
                                >
                                  {m.emoji} {m.name}
                                </button>
                              );
                            })}
                          </div>
                          {(currentSlide as any).gameSettings && (
                            <Select
                              value={(currentSlide as any).gameSettings?.teamMode || "none"}
                              onValueChange={(v) => updateSlide({
                                gameSettings: { ...(currentSlide as any).gameSettings, teamMode: v },
                              })}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Bez týmů</SelectItem>
                                <SelectItem value="random">Náhodné týmy</SelectItem>
                                <SelectItem value="manual">Ruční týmy</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {(currentSlide as any).activitySpec?.activityType === "wall" && (
                          <div className="space-y-2 border-t border-border pt-3">
                            <Label className="text-xs">Otázka pro žáky</Label>
                            <Textarea
                              rows={2}
                              className="text-xs"
                              value={(currentSlide as any).activitySpec?.question || ""}
                              onChange={(e) => updateSlide({ activitySpec: { ...(currentSlide as any).activitySpec, question: e.target.value } })}
                              placeholder="Napište otázku pro žáky..."
                            />
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={(currentSlide as any).activitySpec?.anonymous === true}
                                onCheckedChange={(v) => updateSlide({ activitySpec: { ...(currentSlide as any).activitySpec, anonymous: !!v } })}
                                id="slide-wall-anonymous"
                              />
                              <Label htmlFor="slide-wall-anonymous" className="cursor-pointer text-xs">Anonymní odpovědi</Label>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={(currentSlide as any).activitySpec?.allowMultiple === true}
                                onCheckedChange={(v) => updateSlide({ activitySpec: { ...(currentSlide as any).activitySpec, allowMultiple: !!v } })}
                                id="slide-wall-multiple"
                              />
                              <Label htmlFor="slide-wall-multiple" className="cursor-pointer text-xs">Povolit více odpovědí</Label>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Obrázek ve volném rámci – přizpůsobení plochy */}
                    {selectedBlock?.type === "image" && !!getBlockFrame(selectedBlock) && (
                      <div className="space-y-2 rounded-lg border border-border p-2">
                        <Label className="flex items-center gap-1.5 text-xs">
                          <ImageIcon className="h-3.5 w-3.5" /> Obrázek v rámci
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Velikost se mění tažením za úchyty rámce. Zvolte, jak obrázek plochu vyplní.
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {([
                            { value: "contain", label: "Přizpůsobit" },
                            { value: "cover", label: "Oříznout" },
                          ] as const).map((o) => {
                            const active =
                              ((selectedBlock.props as any)?.objectFit || "contain") === o.value;
                            return (
                              <Button
                                key={o.value}
                                type="button"
                                size="sm"
                                variant={active ? "default" : "outline"}
                                aria-pressed={active}
                                className="h-7 text-xs"
                                onClick={() =>
                                  updateBlock(selectedBlock.id, (b: Block) => ({
                                    ...b,
                                    props: { ...b.props, objectFit: o.value },
                                  }))
                                }
                              >
                                {o.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Strukturální editor bloků – jen jako záloha pod „Více možností“ */}
                    <Collapsible>
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded px-1 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                        <span className="flex items-center gap-1">
                          <Settings2 className="h-3 w-3" /> Více možností
                        </span>
                        <ChevronDown className="h-3 w-3" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-1 max-h-[40vh] overflow-y-auto rounded-lg border border-border bg-muted/20 p-2">
                          <p className="mb-2 text-[11px] text-muted-foreground">
                            Formátování řešte lištou nad plátnem. Zde jsou pokročilé strukturální
                            úpravy vybraného bloku.
                          </p>
                          {selectedBlock ? (
                            <SingleBlockEditor
                              block={selectedBlock}
                              onChange={(props) =>
                                updateBlock(selectedBlock.id, (b: Block) => ({ ...b, props }))
                              }
                            />
                          ) : (
                            <p className="py-3 text-center text-xs text-muted-foreground">
                              Vyberte blok na plátně pro pokročilé úpravy.
                            </p>
                          )}
                        </div>
                        {/* Skrytý BlockEditor drží historii undo/redo pro celý slide. */}
                        <div className="hidden" aria-hidden="true">
                          <BlockEditor
                            blocks={blocks}
                            onChange={(b) => setBlocks(b)}
                            hideToolbar
                            onHistoryChange={setHistory}
                          />
                        </div>
                      </CollapsibleContent>

                    </Collapsible>

                    {/* Poznámky pro učitele */}
                    <div className="space-y-2 border-t border-border pt-3">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <StickyNote className="h-3.5 w-3.5" /> Poznámky pro učitele
                        <span className="font-normal text-muted-foreground">— vidí jen ty, žáci ne</span>
                      </Label>
                      {teacherNotesOpen || (currentSlide as any).teacherNotes ? (
                        <Textarea
                          rows={4}
                          className="text-xs"
                          value={(currentSlide as any).teacherNotes || ""}
                          onChange={(e) => updateSlide({ teacherNotes: e.target.value })}
                          placeholder="Poznámka k tomuto slidu..."
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Žádné poznámky</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setTeacherNotesOpen(true)}
                          >
                            Přidat
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* ---- Sekce Aktivity ---- */}
                  {sidebarSection === "activities" && (
                  <div className="space-y-3 p-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Aktivity</Label>
                      <BetaBadge context="Editor prezentace – sekce Aktivity" />
                    </div>
                    <div>
                      <Label className="text-xs">Z mých lekcí</Label>
                      <p className="mb-1.5 text-[11px] text-muted-foreground">
                        Kliknutím vložíte aktivitu jako nový slide za aktuální.
                      </p>
                      <MyLessonActivitiesList onPick={(item) => insertActivitySlide(item.block, item.title)} />
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-1.5 text-xs"
                      onClick={() => window.open("/ucitel/navrh-podle-metody", "_blank", "noopener")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Návrh podle metody
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      Otevře se v nové záložce, rozdělaná prezentace zůstane zachovaná.
                    </p>

                    {aiActivityButton}
                  </div>
                  )}
                </div>

              </aside>

              {/* 5. CENTRÁLNÍ PLÁTNO */}
              <div ref={canvasWrapRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30 p-4 xl:p-6">
                <div className="absolute left-3 top-3 z-20 flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 bg-background/90 p-0"
                    onClick={() => history?.undo()}
                    disabled={!history?.canUndo}
                    title="Zpět (Ctrl/Cmd+Z)"
                    aria-label="Zpět"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 bg-background/90 p-0"
                    onClick={() => history?.redo()}
                    disabled={!history?.canRedo}
                    title="Vpřed (Ctrl/Cmd+Shift+Z)"
                    aria-label="Vpřed"
                  >
                    <Redo2 className="h-3.5 w-3.5" />
                  </Button>

                  <div className="mx-1 h-6 w-px bg-border" />

                  <Button
                    size="sm"
                    variant={drawMode ? "default" : "outline"}
                    className={`h-8 gap-1 px-2 text-xs ${drawMode ? "" : "bg-background/90"}`}
                    onClick={() => {
                      setDrawMode((v) => !v);
                      setSelectedBlockId(null);
                    }}
                    title="Kreslení tužkou po slidu"
                    aria-pressed={drawMode}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Tužka
                  </Button>

                  {drawMode && (
                    <>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" variant="outline" className="h-8 gap-1 bg-background/90 px-2 text-xs" title="Barva tahu">
                            <span
                              className="inline-block h-3 w-3 rounded-full border border-border"
                              style={{ background: drawColor }}
                            />
                            Barva
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2">
                          <ColorPicker value={drawColor} onChange={(v) => setDrawColor(v || "#FDE047")} />
                        </PopoverContent>
                      </Popover>

                      <Select value={String(drawWidth)} onValueChange={(v) => setDrawWidth(Number(v))}>
                        <SelectTrigger className="h-8 w-[76px] bg-background/90 text-xs" title="Šířka tahu">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 3, 5, 8].map((w) => (
                            <SelectItem key={w} value={String(w)}>{w} px</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 bg-background/90 px-2 text-xs"
                        title="Smazat poslední tah"
                        disabled={!((currentSlide as any)?.drawingStrokes || []).length}
                        onClick={() =>
                          updateSlide({
                            drawingStrokes: (((currentSlide as any).drawingStrokes || []) as DrawingStroke[]).slice(0, -1),
                          })
                        }
                      >
                        <Eraser className="h-3.5 w-3.5" /> Guma
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2 text-xs text-destructive bg-background/90"
                        title="Smazat všechny tahy tohoto slidu"
                        disabled={!((currentSlide as any)?.drawingStrokes || []).length}
                        onClick={() => updateSlide({ drawingStrokes: [] })}
                      >
                        Vymazat vše
                      </Button>
                    </>
                  )}
                </div>

                <div className="mx-auto flex h-full min-h-0 w-full max-w-full flex-col items-center justify-center pt-4">
                  {/* FORMÁTOVACÍ LIŠTA – vždy nad plátnem slidu (pevný slot, bez skákání layoutu) */}
                  <div className="mb-2 flex min-h-[42px] w-full shrink-0 items-center justify-center">
                    {selectedBlock ? (
                      <SlideFloatingFormatToolbar
                        staticBar
                        containerRef={canvasWrapRef}
                        block={selectedBlock}
                        positionKey={`${editingSlideIndex}-${blocks.length}`}
                        framed={!!getBlockFrame(selectedBlock)}
                        onChangeProps={(props) => {
                          if (!selectedBlockId) return;
                          updateBlock(selectedBlockId, (b: Block) => ({ ...b, props }));
                        }}
                        onChangeLayer={(action) => {
                          if (!selectedBlockId) return;
                          const framed = blocks.filter((b: Block) => !!getBlockFrame(b));
                          const idx = framed.findIndex((b: Block) => b.id === selectedBlockId);
                          const maxZ = framed.reduce(
                            (m: number, b: Block) => Math.max(m, typeof b.zIndex === "number" ? b.zIndex : 0),
                            0,
                          );
                          updateBlock(selectedBlockId, (b: Block) => {
                            const current = typeof b.zIndex === "number" ? b.zIndex : idx + 1;
                            const next =
                              action === "front" ? maxZ + 1
                              : action === "forward" ? current + 1
                              : action === "backward" ? Math.max(1, current - 1)
                              : 0;
                            return { ...b, zIndex: next };
                          });
                        }}
                        onMove={(dir) => selectedBlockId && moveBlock(selectedBlockId, dir)}
                        onDelete={() => {
                          if (!selectedBlockId) return;
                          deleteBlock(selectedBlockId);
                          setSelectedBlockId(null);
                        }}
                      />
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Klikněte na blok pro editaci — formátovací lišta se zobrazí zde nad slidem.
                      </p>
                    )}
                  </div>
                  <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                  <SlideCanvas
                    slide={currentSlide}
                    themeId={themeId}
                    editable
                    darkMode={darkPreview}
                    onChangeHeadline={(v) => updateProjector({ headline: v })}
                    onChangeBlock={updateBlock}
                    onMoveBlock={moveBlock}
                    onDeleteBlock={deleteBlock}
                    onChangeHeroImage={(url) => updateSlide({ heroImage: url })}
                    selectedBlockId={selectedBlockId}
                    onSelectBlock={setSelectedBlockId}
                    drawMode={drawMode}
                    drawColor={drawColor}
                    drawWidth={drawWidth}
                    onAddStroke={(stroke: DrawingStroke) =>
                      updateSlide({
                        drawingStrokes: [...(((currentSlide as any).drawingStrokes || []) as DrawingStroke[]), stroke],
                      })
                    }
                  />
                  </div>
                </div>
              </div>
            </div>
          )}

          <ImportPptxToPresentationDialog
            open={importPptxOpen}
            onOpenChange={setImportPptxOpen}
            themeId={themeId}
            onImported={(slides) => {
              const updated = [...pendingSlides, ...slides];
              setPendingSlides(updated);
              setEditingSlideIndex(pendingSlides.length);
              setSelectedBlockId(null);
            }}
          />

          <StartFromTemplateDialog
            open={templateOpen}
            onOpenChange={setTemplateOpen}
            onPick={(slides) => {
              setPendingSlides(applyThemeToSlides(slides, themeId));
              setEditingSlideIndex(0);
            }}
          />

          <AddSlideSheet
            open={addSlideOpen}
            onOpenChange={setAddSlideOpen}
            slides={pendingSlides}
            onAddSlides={(newSlides) => {
              const updated = [...pendingSlides, ...newSlides];
              setPendingSlides(updated);
              setEditingSlideIndex(pendingSlides.length);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!existingSession} onOpenChange={(open) => { if (!open) onCloseExisting(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Existující prezentace</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Máte rozdělanou prezentaci pro tuto lekci. Chcete pokračovat nebo začít novou?</p>
          <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full" onClick={onContinueExisting}>
              Pokračovat v rozběhlé
            </Button>
            <Button className="w-full" onClick={onLaunchNew}>
              Spustit novou
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PresentationEditorDialog;
