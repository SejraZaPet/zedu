import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Monitor, Plus, Trash2, ChevronDown, Save, Sun, Moon } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import BlockEditor from "@/components/admin/BlockEditor";
import type { Block } from "@/lib/textbook-config";

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


const STAGE_W = 1600;
const STAGE_H = 900;

/**
 * Mini replica of ProjectorSlideView so editor preview matches projector 1:1.
 */
function ProjectorPreview({ slide, darkPreview, formatSlideBody }: { slide: any; darkPreview: boolean; formatSlideBody: (s: string) => string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      setScale(Math.min(w / STAGE_W, h / STAGE_H));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bgStyle = darkPreview
    ? { background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" }
    : { background: "hsl(var(--background))" };

  const hasBlocks = slide?.blocks && slide.blocks.length > 0;
  const headline = slide?.projector?.headline;
  const body = slide?.projector?.body;

  return (
    <div ref={frameRef} className="relative aspect-video w-full rounded-xl overflow-hidden shadow-lg border border-border" style={bgStyle}>
      <div
        className={`absolute left-1/2 top-1/2 origin-center ${darkPreview ? "text-white" : "text-foreground"}`}
        style={{
          width: `${STAGE_W}px`,
          height: `${STAGE_H}px`,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-start px-6 py-4 gap-4 min-h-0 overflow-hidden">
            {hasBlocks ? (
              <>
                {headline && (
                  <h2 className={`text-6xl font-bold text-center mb-4 leading-tight shrink-0 ${darkPreview ? "bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200" : ""}`}>
                    {headline}
                  </h2>
                )}
                <div
                  className={`w-full text-2xl space-y-6 pointer-events-none ${darkPreview ? "[&_*]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_.bg-card]:!bg-white/10 [&_.bg-muted\\/40]:!bg-white/10 [&_.bg-muted\\/30]:!bg-white/10 [&_.border]:!border-white/20" : ""}`}
                  style={{ zoom: slide?.projector?.fontScale || 1 } as any}
                >
                  {slide.blocks.map((b: any, i: number) => (
                    <LessonBlock key={b.id || i} block={b} blockIndex={i} isTeacher={false} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className={`text-6xl font-bold text-center mb-4 leading-tight shrink-0 ${darkPreview ? "bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200" : ""}`}>
                  {headline || <span className="opacity-40">Nadpis slidu</span>}
                </h2>
                <div
                  className={`text-2xl leading-relaxed w-full ${darkPreview ? "text-gray-300" : "text-foreground/85"}`}
                  style={{ zoom: slide?.projector?.fontScale || 1 } as any}
                  dangerouslySetInnerHTML={{
                    __html: formatSlideBody(body || "") || '<p class="opacity-40">Text slidu…</p>',
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const PresentationEditorDialog = ({
  presentationLesson, pendingSlides, setPendingSlides,
  editingSlideIndex, setEditingSlideIndex,
  onClose, onLaunch, onSave, hasSavedPresentation,
  existingSession, onContinueExisting, onLaunchNew, onCloseExisting,
}: Props) => {
  const { toast } = useToast();
  const [darkPreview, setDarkPreview] = useState(true);
  const currentSlide = pendingSlides[editingSlideIndex];

  return (
    <>
      <Dialog open={!!presentationLesson && pendingSlides.length > 0} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-7xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>Upravit prezentaci – {presentationLesson?.title}</span>
              <Badge variant={hasSavedPresentation ? "default" : "secondary"} className="text-xs">
                {hasSavedPresentation ? "Uložená prezentace" : "Nová prezentace"}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Slide thumbnails */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
            {pendingSlides.map((slide, i) => (
              <button
                key={i}
                onClick={() => setEditingSlideIndex(i)}
                className={`flex-shrink-0 w-28 h-16 rounded-md border-2 p-1.5 text-left overflow-hidden transition-colors ${
                  i === editingSlideIndex ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <div className="text-[8px] text-muted-foreground mb-0.5">Slide {i + 1}</div>
                <div className="text-[9px] font-bold truncate leading-tight">
                  {slide.projector?.headline || `Bez nadpisu`}
                </div>
                <div className="text-[8px] text-muted-foreground line-clamp-2 leading-tight">
                  {slide.projector?.body?.slice(0, 60) || ""}
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> Přidat slide <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => {
                  const newSlide = {
                    slideId: `slide-custom-${Date.now()}`,
                    type: "explain",
                    projector: { headline: "", body: "" },
                    device: { instructions: "Sledujte výklad." },
                    teacherNotes: "",
                    blocks: [],
                  };
                  const updated = [...pendingSlides];
                  updated.splice(editingSlideIndex + 1, 0, newSlide);
                  setPendingSlides(updated);
                  setEditingSlideIndex(editingSlideIndex + 1);
                }}>
                  📖 Výkladový slide
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const newSlide = {
                    slideId: `slide-activity-${Date.now()}`,
                    type: "activity",
                    projector: { headline: "Aktivita", body: "" },
                    device: { instructions: "Splňte aktivitu na svém zařízení." },
                    teacherNotes: "",
                    blocks: [],
                    activitySpec: { activityType: "true_false", question: "", statements: [] },
                  };
                  const updated = [...pendingSlides];
                  updated.splice(editingSlideIndex + 1, 0, newSlide);
                  setPendingSlides(updated);
                  setEditingSlideIndex(editingSlideIndex + 1);
                }}>
                  ✏️ Aktivita (pravda/nepravda)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const newSlide = {
                    slideId: `slide-wall-${Date.now()}`,
                    type: "activity",
                    projector: { headline: "Zeď odpovědí", body: "" },
                    device: { instructions: "Napište svou odpověď." },
                    teacherNotes: "",
                    blocks: [],
                    activitySpec: { activityType: "wall", question: "", anonymous: false },
                  };
                  const updated = [...pendingSlides];
                  updated.splice(editingSlideIndex + 1, 0, newSlide);
                  setPendingSlides(updated);
                  setEditingSlideIndex(editingSlideIndex + 1);
                }}>
                  🧱 Zeď (odpovědi žáků)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const newSlide = {
                    slideId: `slide-quiz-${Date.now()}`,
                    type: "activity",
                    projector: { headline: "Kvíz", body: "" },
                    device: { instructions: "Vyberte správnou odpověď." },
                    teacherNotes: "",
                    blocks: [],
                    activitySpec: { activityType: "quiz", question: "", options: [], correctIndex: 0 },
                  };
                  const updated = [...pendingSlides];
                  updated.splice(editingSlideIndex + 1, 0, newSlide);
                  setPendingSlides(updated);
                  setEditingSlideIndex(editingSlideIndex + 1);
                }}>
                  ❓ Kvíz (výběr odpovědi)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

          {currentSlide && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Live preview */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">Náhled slidu</Label>
                  <button
                    type="button"
                    onClick={() => setDarkPreview((v) => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {darkPreview ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    {darkPreview ? "Světlý" : "Tmavý"}
                  </button>
                </div>
                <ProjectorPreview slide={currentSlide} darkPreview={darkPreview} formatSlideBody={formatSlideBody} />

                <p className="text-[10px] text-muted-foreground mt-2 leading-tight">
                  Náhled odráží přesně to, jak slide uvidí žáci na projektoru i v učebnici.
                </p>
              </div>

              {/* Form */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Nadpis slidu</Label>
                  <Input
                    value={currentSlide.projector?.headline || ""}
                    onChange={(e) => {
                      const updated = [...pendingSlides];
                      updated[editingSlideIndex] = { ...updated[editingSlideIndex], projector: { ...updated[editingSlideIndex].projector, headline: e.target.value } };
                      setPendingSlides(updated);
                    }}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">Velikost písma</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {Math.round(((currentSlide.projector?.fontScale as number) || 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.7}
                    max={1.6}
                    step={0.05}
                    value={(currentSlide.projector?.fontScale as number) || 1}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      const updated = [...pendingSlides];
                      updated[editingSlideIndex] = {
                        ...updated[editingSlideIndex],
                        projector: { ...updated[editingSlideIndex].projector, fontScale: v },
                      };
                      setPendingSlides(updated);
                    }}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <Label className="text-xs">Obsah slidu (bloky jako v učebnici)</Label>
                  <div className="mt-2 border border-border rounded-lg p-3 bg-muted/20 max-h-[55vh] overflow-y-auto">
                    <BlockEditor
                      blocks={((currentSlide as any).blocks || []) as Block[]}
                      onChange={(blocks) => {
                        const updated = [...pendingSlides];
                        updated[editingSlideIndex] = { ...updated[editingSlideIndex], blocks };
                        setPendingSlides(updated);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Instrukce pro žáka</Label>
                  <Input
                    value={currentSlide.device?.instructions || ""}
                    onChange={(e) => {
                      const updated = [...pendingSlides];
                      updated[editingSlideIndex] = { ...updated[editingSlideIndex], device: { ...updated[editingSlideIndex].device, instructions: e.target.value } };
                      setPendingSlides(updated);
                    }}
                  />
                </div>
                {currentSlide?.type === "activity" && (
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div>
                      <Label className="text-xs">Typ aktivity</Label>
                      <Select
                        value={(currentSlide as any).activitySpec?.activityType || "true_false"}
                        onValueChange={(v) => {
                          const updated = [...pendingSlides];
                          updated[editingSlideIndex] = {
                            ...updated[editingSlideIndex],
                            activitySpec: { ...(updated[editingSlideIndex] as any).activitySpec, activityType: v },
                          };
                          setPendingSlides(updated);
                        }}
                      >
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true_false">Pravda / Nepravda</SelectItem>
                          <SelectItem value="quiz">Kvíz</SelectItem>
                          <SelectItem value="wall">Zeď odpovědí</SelectItem>
                          <SelectItem value="flashcards">Kartičky</SelectItem>
                          <SelectItem value="matching">Párování</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(currentSlide as any).activitySpec?.activityType === "wall" && (
                      <>
                        <div>
                          <Label className="text-xs">Otázka pro žáky</Label>
                          <Textarea
                            rows={2}
                            value={(currentSlide as any).activitySpec?.question || ""}
                            onChange={(e) => {
                              const updated = [...pendingSlides];
                              updated[editingSlideIndex] = {
                                ...updated[editingSlideIndex],
                                activitySpec: { ...(updated[editingSlideIndex] as any).activitySpec, question: e.target.value },
                              };
                              setPendingSlides(updated);
                            }}
                            placeholder="Napište otázku pro žáky..."
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={(currentSlide as any).activitySpec?.anonymous === true}
                            onCheckedChange={(v) => {
                              const updated = [...pendingSlides];
                              updated[editingSlideIndex] = {
                                ...updated[editingSlideIndex],
                                activitySpec: { ...(updated[editingSlideIndex] as any).activitySpec, anonymous: !!v },
                              };
                              setPendingSlides(updated);
                            }}
                            id="slide-wall-anonymous"
                          />
                          <Label htmlFor="slide-wall-anonymous" className="text-xs cursor-pointer">
                            Anonymní odpovědi
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={(currentSlide as any).activitySpec?.allowMultiple === true}
                            onCheckedChange={(v) => {
                              const updated = [...pendingSlides];
                              updated[editingSlideIndex] = {
                                ...updated[editingSlideIndex],
                                activitySpec: { ...(updated[editingSlideIndex] as any).activitySpec, allowMultiple: !!v },
                              };
                              setPendingSlides(updated);
                            }}
                            id="slide-wall-multiple"
                          />
                          <Label htmlFor="slide-wall-multiple" className="text-xs cursor-pointer">
                            Povolit více odpovědí od jednoho žáka
                          </Label>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 mt-4">
            {onSave && (
              <Button
                variant="outline"
                onClick={async () => {
                  await onSave(pendingSlides);
                  toast({ title: "Prezentace uložena", description: "Změny byly uloženy k lekci." });
                }}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                Uložit
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>Zrušit</Button>
            <Button onClick={() => onLaunch(pendingSlides)} className="gap-2">
              <Monitor className="w-4 h-4" />
              Spustit prezentaci
            </Button>
          </DialogFooter>
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
