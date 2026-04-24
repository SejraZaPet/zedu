import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Monitor, Plus, Trash2, ChevronDown, Save } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

export const PresentationEditorDialog = ({
  presentationLesson, pendingSlides, setPendingSlides,
  editingSlideIndex, setEditingSlideIndex,
  onClose, onLaunch, onSave, hasSavedPresentation,
  existingSession, onContinueExisting, onLaunchNew, onCloseExisting,
}: Props) => {
  const { toast } = useToast();
  return (
    <>
      <Dialog open={!!presentationLesson && pendingSlides.length > 0} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span>Upravit prezentaci – {presentationLesson?.title}</span>
              <Badge variant={hasSavedPresentation ? "default" : "secondary"} className="text-xs">
                {hasSavedPresentation ? "Uložená prezentace" : "Nová prezentace"}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-1 flex-wrap mb-4">
            {pendingSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => setEditingSlideIndex(i)}
                className={`w-8 h-8 rounded text-xs font-medium ${i === editingSlideIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mb-4">
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
          {pendingSlides[editingSlideIndex] && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nadpis (projektor)</Label>
                <Input
                  value={pendingSlides[editingSlideIndex].projector?.headline || ""}
                  onChange={(e) => {
                    const updated = [...pendingSlides];
                    updated[editingSlideIndex] = { ...updated[editingSlideIndex], projector: { ...updated[editingSlideIndex].projector, headline: e.target.value } };
                    setPendingSlides(updated);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Text (projektor)</Label>
                <Textarea
                  rows={4}
                  value={pendingSlides[editingSlideIndex].projector?.body || ""}
                  onChange={(e) => {
                    const updated = [...pendingSlides];
                    updated[editingSlideIndex] = { ...updated[editingSlideIndex], projector: { ...updated[editingSlideIndex].projector, body: e.target.value } };
                    setPendingSlides(updated);
                  }}
                />
              </div>
              {(pendingSlides[editingSlideIndex] as any)?.tableData && (
                <div>
                  <Label className="text-xs">Tabulka (náhled)</Label>
                  <div className="overflow-x-auto mt-1 border border-border rounded-lg">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          {(pendingSlides[editingSlideIndex] as any).tableData.headers.map((h: string, i: number) => (
                            <th key={i} className="border border-border bg-muted px-2 py-1 text-left font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(pendingSlides[editingSlideIndex] as any).tableData.rows.map((row: string[], ri: number) => (
                          <tr key={ri}>
                            {row.map((cell: string, ci: number) => (
                              <td key={ci} className="border border-border px-2 py-1">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs">Instrukce pro žáka</Label>
                <Input
                  value={pendingSlides[editingSlideIndex].device?.instructions || ""}
                  onChange={(e) => {
                    const updated = [...pendingSlides];
                    updated[editingSlideIndex] = { ...updated[editingSlideIndex], device: { ...updated[editingSlideIndex].device, instructions: e.target.value } };
                    setPendingSlides(updated);
                  }}
                />
              </div>
              {pendingSlides[editingSlideIndex]?.type === "activity" && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <div>
                    <Label className="text-xs">Typ aktivity</Label>
                    <Select
                      value={(pendingSlides[editingSlideIndex] as any).activitySpec?.activityType || "true_false"}
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
                  {(pendingSlides[editingSlideIndex] as any).activitySpec?.activityType === "wall" && (
                    <div>
                      <Label className="text-xs">Otázka pro žáky</Label>
                      <Textarea
                        rows={2}
                        value={(pendingSlides[editingSlideIndex] as any).activitySpec?.question || ""}
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
                  )}
                </div>
              )}
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
