import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Monitor, Plus, Trash2, ChevronDown, Save, Sun, Moon, Type, List, Image as ImageIcon, Table as TableIcon, Settings2, Undo2, Redo2, ZoomIn } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SLIDE_GAME_MODES } from "@/lib/game-slide-settings";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import BlockEditor, { type BlockEditorHistory } from "@/components/admin/BlockEditor";
import SlideCanvas, { SLIDE_LAYOUTS, type SlideLayout } from "@/components/admin/SlideCanvas";
import { MediaPickerDialog } from "@/components/media/MediaPickerDialog";
import { AddSlideSheet } from "@/components/game/AddSlideSheet";
import { createDefaultBlock, type Block } from "@/lib/textbook-config";
import ZoomZonesEditor from "@/components/admin/ZoomZonesEditor";
import { isZoomableSlide, type ZoomZone } from "@/lib/zoom-zones";
import ThemeGalleryPopover from "@/components/admin/ThemeGalleryPopover";
import StartFromTemplateDialog from "@/components/admin/StartFromTemplateDialog";
import IconPickerDialog from "@/components/admin/IconPickerDialog";
import { SlideBody } from "@/components/admin/SlideCanvas";
import { STAGE_W, STAGE_H } from "@/components/admin/SlideCanvas";
import { applyThemeToSlides, getPresentationTheme, themeIdFromSlides, themeStageStyle } from "@/lib/presentation-themes";
import { LayoutTemplate, Shapes } from "lucide-react";


interface Props {
  presentationLesson: { title: string } | null;
  pendingSlides: any[];
  setPendingSlides: (slides: any[]) => void;
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatInline(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function formatSlideBody(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // table block: consecutive lines containing " | "
    if (line.includes(" | ")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes(" | ")) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines.map((l) =>
        l.split(" | ").map((c) => `<td class="border border-current/20 px-2 py-1">${formatInline(c.trim())}</td>`).join(""),
      );
      out.push(`<table class="border-collapse my-2 text-xs"><tbody>${rows.map((r) => `<tr>${r}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    if (line.startsWith("• ") || line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("• ") || lines[i].startsWith("- "))) {
        items.push(`<li>${formatInline(lines[i].slice(2))}</li>`);
        i++;
      }
      out.push(`<ul class="list-disc pl-5 space-y-1 my-1">${items.join("")}</ul>`);
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(`<h3 class="font-semibold text-base mt-2 mb-1">${formatInline(line.slice(3))}</h3>`);
    } else if (line.trim() === "") {
      out.push("<br/>");
    } else {
      out.push(`<p class="my-1">${formatInline(line)}</p>`);
    }
    i++;
  }
  return out.join("");
}




export const PresentationEditorDialog = ({
  presentationLesson, pendingSlides, setPendingSlides,
  editingSlideIndex, setEditingSlideIndex,
  onClose, onLaunch, onSave, hasSavedPresentation,
  existingSession, onContinueExisting, onLaunchNew, onCloseExisting,
}: Props) => {
  const { toast } = useToast();
  const [darkPreview, setDarkPreview] = useState(true);
  const [addSlideOpen, setAddSlideOpen] = useState(false);
  const [history, setHistory] = useState<BlockEditorHistory | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const currentSlide = pendingSlides[editingSlideIndex];
  const themeId = themeIdFromSlides(pendingSlides);
  const theme = getPresentationTheme(themeId);

  const setThemeId = (next: string) => setPendingSlides(applyThemeToSlides(pendingSlides, next));

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

  return (
    <>
      <Dialog open={!!presentationLesson && pendingSlides.length > 0} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-7xl max-h-[92vh] overflow-y-auto p-0">
          {/* 1. STICKY HEADER – always visible actions */}
          <DialogHeader className="sticky top-0 z-50 bg-muted/60 backdrop-blur-sm border-b border-border shadow-sm px-5 py-3 space-y-0">
            <div className="flex items-center gap-3 flex-wrap">
              <DialogTitle className="flex items-center gap-2 flex-wrap text-base">
                <span>Upravit prezentaci – {presentationLesson?.title}</span>
                <Badge variant={hasSavedPresentation ? "default" : "secondary"} className="text-xs">
                  {hasSavedPresentation ? "Uložená prezentace" : "Nová prezentace"}
                </Badge>
              </DialogTitle>
              <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
                <Button size="sm" variant="ghost" className="h-9" onClick={onClose}>
                  Zrušit
                </Button>
                {onSave && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-9"
                    onClick={async () => {
                      await onSave(pendingSlides);
                      toast({ title: "Prezentace uložena", description: "Změny byly uloženy k lekci." });
                    }}
                  >
                    <Save className="w-4 h-4" />
                    Uložit
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => onLaunch(pendingSlides)}
                  className="gap-1.5 h-9 bg-gradient-brand text-white border-0 hover:opacity-90"
                >
                  <Monitor className="w-4 h-4" />
                  Spustit prezentaci
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="px-5 pb-5 space-y-4">
          {/* 2. Vizuální náhledy slidů */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pendingSlides.map((slide, i) => (
              <button
                key={slide?.slideId || i}
                onClick={() => setEditingSlideIndex(i)}
                title={slide.projector?.headline || `Slide ${i + 1}`}
                className={`relative flex-shrink-0 w-40 aspect-video rounded-md border-2 overflow-hidden transition-colors ${
                  i === editingSlideIndex ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-muted-foreground/50"
                }`}
                style={themeStageStyle(theme)}
              >
                <div
                  className="absolute left-0 top-0 origin-top-left pointer-events-none"
                  style={{
                    width: STAGE_W,
                    height: STAGE_H,
                    transform: `scale(${160 / STAGE_W})`,
                  }}
                >
                  <SlideBody slide={slide} themeId={themeId} />
                </div>
                <span className="absolute bottom-1 left-1 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                  {i + 1}
                </span>
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap pb-3 border-b border-border">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setAddSlideOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Přidat slide
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setTemplateOpen(true)}>
              <LayoutTemplate className="w-3.5 h-3.5" /> Začít od šablony
            </Button>
            {pendingSlides.length > 1 && (
              <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => {
                const updated = pendingSlides.filter((_, i) => i !== editingSlideIndex);
                setPendingSlides(updated);
                setEditingSlideIndex(Math.min(editingSlideIndex, updated.length - 1));
              }}>
                <Trash2 className="w-3.5 h-3.5" /> Smazat slide
              </Button>
            )}
          </div>


          {currentSlide && (() => {
            const updateSlide = (patch: any) => {
              const updated = [...pendingSlides];
              updated[editingSlideIndex] = { ...updated[editingSlideIndex], ...patch };
              setPendingSlides(updated);
            };
            const updateProjector = (patch: any) => {
              updateSlide({ projector: { ...currentSlide.projector, ...patch } });
            };
            const blocks: Block[] = (currentSlide.blocks || []) as Block[];
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
            const updateBlock = (id: string, patch: any) => {
              setBlocks(
                blocks.map((b) => {
                  if (b.id !== id) return b;
                  return typeof patch === "function" ? patch(b) : { ...b, ...patch };
                }),
              );
            };

            return (
              <div className="space-y-3">
                {/* 3. Unified slide tool panel (layout, blocks, font, theme, undo/redo) */}
                <div className="flex flex-wrap items-center gap-2 p-2 bg-muted/30 rounded-lg border border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => history?.undo()}
                    disabled={!history?.canUndo}
                    title="Zpět (Ctrl/Cmd+Z)"
                    aria-label="Zpět"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => history?.redo()}
                    disabled={!history?.canRedo}
                    title="Vpřed (Ctrl/Cmd+Shift+Z)"
                    aria-label="Vpřed"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </Button>

                  <div className="h-6 w-px bg-border" />

                  <div className="flex items-center gap-2">

                    <Label className="text-xs whitespace-nowrap">Rozvržení:</Label>
                    <Select
                      value={(currentSlide.layout as SlideLayout) || "full"}
                      onValueChange={(v) => updateSlide({ layout: v as SlideLayout })}
                    >
                      <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SLIDE_LAYOUTS.map((l) => (
                          <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="h-6 w-px bg-border" />

                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => addBlock("paragraph")}>
                    <Type className="w-3.5 h-3.5" /> Text
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => addBlock("bullet_list")}>
                    <List className="w-3.5 h-3.5" /> Odrážky
                  </Button>
                  <MediaPickerDialog
                    imageOnly
                    onPick={(url) => {
                      const newBlock = createDefaultBlock("image");
                      newBlock.props = { ...newBlock.props, url };
                      setBlocks([...blocks, newBlock]);
                    }}
                    trigger={
                      <Button size="sm" variant="outline" className="h-8 gap-1">
                        <ImageIcon className="w-3.5 h-3.5" /> Obrázek
                      </Button>
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
                      <Button size="sm" variant="outline" className="h-8 gap-1">
                        <Shapes className="w-3.5 h-3.5" /> Ikona
                      </Button>
                    }
                  />
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => addBlock("table")}>
                    <TableIcon className="w-3.5 h-3.5" /> Tabulka
                  </Button>

                  <div className="ml-auto flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">Písmo</Label>
                      <input
                        type="range"
                        min={0.7}
                        max={1.6}
                        step={0.05}
                        value={(currentSlide.projector?.fontScale as number) || 1}
                        onChange={(e) => updateProjector({ fontScale: parseFloat(e.target.value) })}
                        className="w-24 accent-primary"
                      />
                      <span className="text-xs text-muted-foreground tabular-nums w-10">
                        {Math.round(((currentSlide.projector?.fontScale as number) || 1) * 100)}%
                      </span>
                    </div>
                    <ThemeGalleryPopover themeId={themeId} onChange={setThemeId} />
                    <button
                      type="button"
                      onClick={() => setDarkPreview((v) => !v)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {darkPreview ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                      {darkPreview ? "Světlý" : "Tmavý"}
                    </button>
                  </div>
                </div>

                {/* Visual slide canvas (click to edit) */}
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
                />
                <p className="text-[11px] text-muted-foreground">
                  Klikněte na nadpis nebo text v náhledu a upravte jej. Při najetí na blok se zobrazí ovládání ↑ ↓ 🗑.
                </p>

                {/* Zóny přiblížení */}
                {isZoomableSlide(currentSlide) && (
                  <Collapsible className="border border-border rounded-lg mt-1">
                    <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors">
                      <span className="flex items-center gap-1.5">
                        <ZoomIn className="w-3.5 h-3.5" />
                        Zóny přiblížení ({(currentSlide.zoomZones || []).length})
                      </span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3">
                      <ZoomZonesEditor
                        slide={currentSlide}
                        darkMode={darkPreview}
                        onChange={(zones: ZoomZone[]) => updateSlide({ zoomZones: zones })}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Instrukce + aktivita */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label className="text-xs">Instrukce pro žáka</Label>
                    <Input
                      value={currentSlide.device?.instructions || ""}
                      onChange={(e) => updateSlide({ device: { ...currentSlide.device, instructions: e.target.value } })}
                    />
                  </div>
                  {currentSlide?.type === "activity" && (
                    <div>
                      <Label className="text-xs">Typ aktivity</Label>
                      <Select
                        value={(currentSlide as any).activitySpec?.activityType || "true_false"}
                        onValueChange={(v) => updateSlide({ activitySpec: { ...(currentSlide as any).activitySpec, activityType: v } })}
                      >
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
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
                  )}
                </div>

                {currentSlide?.type === "activity" && (
                  <div className="pt-3 mt-1 border-t border-border space-y-2">
                    <div>
                      <Label className="text-xs">Herní režim tohoto slidu</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Platí jen pro tento slide, nezávisle na zbytku prezentace.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => updateSlide({ gameSettings: undefined })}
                        className={`rounded-lg border-2 px-2 py-1.5 text-xs font-medium transition-colors ${
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
                            className={`rounded-lg border-2 px-2 py-1.5 text-xs font-medium transition-colors ${
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
                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Týmy:</Label>
                        <Select
                          value={(currentSlide as any).gameSettings?.teamMode || "none"}
                          onValueChange={(v) => updateSlide({
                            gameSettings: { ...(currentSlide as any).gameSettings, teamMode: v },
                          })}
                        >
                          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Bez týmů</SelectItem>
                            <SelectItem value="random">Náhodné týmy</SelectItem>
                            <SelectItem value="manual">Ruční týmy</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}



                {currentSlide?.type === "activity" && (currentSlide as any).activitySpec?.activityType === "wall" && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div>
                      <Label className="text-xs">Otázka pro žáky</Label>
                      <Textarea
                        rows={2}
                        value={(currentSlide as any).activitySpec?.question || ""}
                        onChange={(e) => updateSlide({ activitySpec: { ...(currentSlide as any).activitySpec, question: e.target.value } })}
                        placeholder="Napište otázku pro žáky..."
                      />
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={(currentSlide as any).activitySpec?.anonymous === true}
                          onCheckedChange={(v) => updateSlide({ activitySpec: { ...(currentSlide as any).activitySpec, anonymous: !!v } })}
                          id="slide-wall-anonymous"
                        />
                        <Label htmlFor="slide-wall-anonymous" className="text-xs cursor-pointer">Anonymní odpovědi</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={(currentSlide as any).activitySpec?.allowMultiple === true}
                          onCheckedChange={(v) => updateSlide({ activitySpec: { ...(currentSlide as any).activitySpec, allowMultiple: !!v } })}
                          id="slide-wall-multiple"
                        />
                        <Label htmlFor="slide-wall-multiple" className="text-xs cursor-pointer">Povolit více odpovědí</Label>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Advanced editor (collapsible, no action buttons inside) */}
                <Collapsible className="border border-border rounded-lg mt-1">
                  <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors">
                    <span className="flex items-center gap-1.5">
                      <Settings2 className="w-3.5 h-3.5" />
                      Pokročilý editor bloků
                    </span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-3 border-t border-border bg-muted/20 max-h-[50vh] overflow-y-auto">
                      <BlockEditor
                        blocks={blocks}
                        onChange={(b) => setBlocks(b)}
                        hideToolbar
                        onHistoryChange={setHistory}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })()}
          </div>

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
          <DialogFooter className="gap-2 mt-4 flex-col sm:flex-row">
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
