import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, HelpCircle, MessageSquare, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AddKind = "menu" | "text" | "mcq" | "wall";

interface AddSlideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  slides: any[];
}

function buildTextSlide(headline: string, body: string) {
  return {
    slideId: `live-${Date.now()}`,
    type: "explain",
    projector: { headline: headline.trim(), body: body.trim() },
    device: { instructions: "Sledujte projektor." },
  };
}

function buildMcqSlide(question: string, options: string[], correctIdx: number) {
  return {
    slideId: `live-${Date.now()}`,
    type: "activity",
    projector: { headline: question.trim(), body: "" },
    device: { instructions: "Vyberte správnou odpověď." },
    activitySpec: {
      activityType: "mcq",
      question: question.trim(),
      options: options.map((text, i) => ({
        text: text.trim(),
        correct: i === correctIdx,
        isCorrect: i === correctIdx,
      })),
      correctIndex: correctIdx,
    },
  };
}

function buildWallSlide(prompt: string, anonymous: boolean) {
  return {
    slideId: `live-${Date.now()}`,
    type: "activity",
    projector: { headline: prompt.trim(), body: "" },
    device: { instructions: "Napište svou odpověď." },
    activitySpec: {
      activityType: "wall",
      question: prompt.trim(),
      anonymous,
      allowMultiple: false,
    },
  };
}

export function AddSlideSheet({
  open,
  onOpenChange,
  sessionId,
  slides,
}: AddSlideSheetProps) {
  const [kind, setKind] = useState<AddKind>("menu");
  const [busy, setBusy] = useState(false);

  // text
  const [textHeadline, setTextHeadline] = useState("");
  const [textBody, setTextBody] = useState("");

  // mcq
  const [mcqQuestion, setMcqQuestion] = useState("");
  const [mcqOptions, setMcqOptions] = useState<string[]>(["", "", "", ""]);
  const [mcqCorrect, setMcqCorrect] = useState(0);

  // wall
  const [wallPrompt, setWallPrompt] = useState("");
  const [wallAnonymous, setWallAnonymous] = useState(true);

  const reset = () => {
    setKind("menu");
    setTextHeadline("");
    setTextBody("");
    setMcqQuestion("");
    setMcqOptions(["", "", "", ""]);
    setMcqCorrect(0);
    setWallPrompt("");
    setWallAnonymous(true);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const appendAndJump = async (newSlide: any) => {
    setBusy(true);
    try {
      const newSlides = [...(slides || []), newSlide];
      const newIndex = newSlides.length - 1;
      const { error } = await supabase
        .from("game_sessions")
        .update({
          activity_data: newSlides as any,
          current_question_index: newIndex,
          question_started_at: new Date().toISOString(),
          status: "playing",
        })
        .eq("id", sessionId);
      if (error) throw error;
      toast.success("Slide přidán a zobrazen.");
      close();
    } catch (e: any) {
      toast.error(e.message || "Nepodařilo se přidat slide.");
    } finally {
      setBusy(false);
    }
  };

  const submitText = () => {
    if (!textHeadline.trim()) {
      toast.error("Doplňte nadpis.");
      return;
    }
    appendAndJump(buildTextSlide(textHeadline, textBody));
  };

  const submitMcq = () => {
    if (!mcqQuestion.trim()) {
      toast.error("Doplňte otázku.");
      return;
    }
    const filled = mcqOptions.filter((o) => o.trim()).length;
    if (filled < 2) {
      toast.error("Doplňte alespoň 2 možnosti.");
      return;
    }
    if (!mcqOptions[mcqCorrect]?.trim()) {
      toast.error("Označte správnou odpověď z vyplněných možností.");
      return;
    }
    appendAndJump(buildMcqSlide(mcqQuestion, mcqOptions, mcqCorrect));
  };

  const submitWall = () => {
    if (!wallPrompt.trim()) {
      toast.error("Doplňte zadání.");
      return;
    }
    appendAndJump(buildWallSlide(wallPrompt, wallAnonymous));
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
        else onOpenChange(true);
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-2">
            {kind !== "menu" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setKind("menu")}
                disabled={busy}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <SheetTitle>
              {kind === "menu" && "Přidat slide"}
              {kind === "text" && "Textový slide"}
              {kind === "mcq" && "Otázka (MCQ)"}
              {kind === "wall" && "Zeď aktivita"}
            </SheetTitle>
          </div>
          <SheetDescription>
            Slide bude přidán na konec živé prezentace a okamžitě zobrazen žákům.
            Původní lekce zůstane beze změny.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {kind === "menu" && (
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setKind("text")}
              >
                <FileText className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Textový slide</p>
                  <p className="text-xs text-muted-foreground">
                    Nadpis a krátký výklad nebo poznámka
                  </p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setKind("mcq")}
              >
                <HelpCircle className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Otázka</p>
                  <p className="text-xs text-muted-foreground">
                    Rychlá MCQ se 4 možnostmi
                  </p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => setKind("wall")}
              >
                <MessageSquare className="w-5 h-5 mr-3 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Zeď aktivita</p>
                  <p className="text-xs text-muted-foreground">
                    Žáci píší krátké odpovědi na zeď
                  </p>
                </div>
              </Button>
            </div>
          )}

          {kind === "text" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="text-headline">Nadpis</Label>
                <Input
                  id="text-headline"
                  value={textHeadline}
                  onChange={(e) => setTextHeadline(e.target.value)}
                  placeholder="Např. Shrnutí kapitoly"
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="text-body">Text</Label>
                <Textarea
                  id="text-body"
                  rows={6}
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  placeholder="Volitelný text. Můžete použít odrážky • na začátku řádku."
                  disabled={busy}
                />
              </div>
              <Button onClick={submitText} disabled={busy} className="w-full">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Přidat a zobrazit
              </Button>
            </div>
          )}

          {kind === "mcq" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="mcq-q">Otázka</Label>
                <Textarea
                  id="mcq-q"
                  rows={2}
                  value={mcqQuestion}
                  onChange={(e) => setMcqQuestion(e.target.value)}
                  placeholder="Zadejte otázku"
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label>Možnosti (vyberte správnou)</Label>
                <RadioGroup
                  value={String(mcqCorrect)}
                  onValueChange={(v) => setMcqCorrect(Number(v))}
                >
                  {mcqOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <RadioGroupItem value={String(i)} id={`mcq-opt-${i}`} />
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const next = [...mcqOptions];
                          next[i] = e.target.value;
                          setMcqOptions(next);
                        }}
                        placeholder={`Možnost ${i + 1}`}
                        disabled={busy}
                      />
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <Button onClick={submitMcq} disabled={busy} className="w-full">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Přidat a zobrazit
              </Button>
            </div>
          )}

          {kind === "wall" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="wall-prompt">Zadání</Label>
                <Textarea
                  id="wall-prompt"
                  rows={3}
                  value={wallPrompt}
                  onChange={(e) => setWallPrompt(e.target.value)}
                  placeholder="Např. Co vás dnes nejvíc zaujalo?"
                  disabled={busy}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={wallAnonymous}
                  onChange={(e) => setWallAnonymous(e.target.checked)}
                  disabled={busy}
                />
                Anonymní odpovědi
              </label>
              <Button onClick={submitWall} disabled={busy} className="w-full">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Přidat a zobrazit
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
